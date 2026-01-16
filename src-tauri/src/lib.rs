mod tools;

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedTool {
    pub name: String,
    pub id: String,
    pub config_path: String,
    pub skills_path: String,
    pub installed: bool,
    pub skills_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledSkill {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub tool_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillHubSkill {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub author: String,
    pub category: String,
    pub simple_score: Option<f64>,
    pub simple_rating: Option<String>,
    pub github_stars: Option<i32>,
    pub repo_url: String,
}

// Detect all supported AI coding tools
#[tauri::command]
async fn detect_tools() -> Result<Vec<DetectedTool>, String> {
    tools::detect_all_tools().await
}

// Get installed skills for a specific tool
#[tauri::command]
async fn get_installed_skills(tool_id: String) -> Result<Vec<InstalledSkill>, String> {
    tools::get_skills_for_tool(&tool_id).await
}

// Install a skill from SkillHub to a specific tool
#[tauri::command]
async fn install_skill(
    skill_content: String,
    skill_name: String,
    tool_ids: Vec<String>,
) -> Result<Vec<String>, String> {
    tools::install_skill_to_tools(&skill_content, &skill_name, &tool_ids).await
}

// Uninstall a skill from a specific tool
#[tauri::command]
async fn uninstall_skill(skill_path: String) -> Result<(), String> {
    tools::uninstall_skill(&skill_path).await
}

// Read skill content from path (for syncing)
#[tauri::command]
async fn read_skill_content(skill_path: String) -> Result<String, String> {
    tools::read_skill_content(&skill_path).await
}

// Search skills from SkillHub API (using public desktop endpoint)
#[tauri::command]
async fn search_skills(query: String, limit: Option<i32>) -> Result<Vec<SkillHubSkill>, String> {
    let limit = limit.unwrap_or(20);
    let client = reqwest::Client::new();

    let response = client
        .post("http://localhost:3000/api/v1/desktop/search")
        .json(&serde_json::json!({
            "query": query,
            "limit": limit
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to search skills: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let skills: Vec<SkillHubSkill> = serde_json::from_value(
        data.get("skills").cloned().unwrap_or(serde_json::json!([]))
    ).unwrap_or_default();

    Ok(skills)
}

// Get skill catalog from SkillHub API (using public desktop endpoint)
#[tauri::command]
async fn get_catalog(
    page: Option<i32>,
    limit: Option<i32>,
    category: Option<String>,
    sort_by: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

    let mut url = format!(
        "http://localhost:3000/api/v1/desktop/catalog?page={}&limit={}",
        page.unwrap_or(1),
        limit.unwrap_or(20)
    );

    if let Some(cat) = category {
        url.push_str(&format!("&category={}", cat));
    }
    if let Some(sort) = sort_by {
        url.push_str(&format!("&sortBy={}", sort));
    }

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to get catalog: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// Get skill detail from SkillHub API (using public desktop endpoint)
#[tauri::command]
async fn get_skill_detail(slug: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(&format!("http://localhost:3000/api/v1/desktop/skills/{}", slug))
        .send()
        .await
        .map_err(|e| format!("Failed to get skill detail: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// Open a folder in the system file explorer
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    tools::open_folder_in_explorer(&path)
}

// Get folder tree structure for visualization
#[tauri::command]
async fn get_folder_tree(path: String, max_depth: Option<usize>) -> Result<tools::FileNode, String> {
    tools::get_folder_tree(&path, max_depth.unwrap_or(5)).await
}

// Read a single file's content
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tools::read_file_content(&path).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            detect_tools,
            get_installed_skills,
            install_skill,
            uninstall_skill,
            read_skill_content,
            search_skills,
            get_catalog,
            get_skill_detail,
            open_folder,
            get_folder_tree,
            read_file,
        ])
        .setup(|app| {
            // Create tray menu
            let show_item = MenuItem::with_id(app, "show", "Show SkillHub", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide window instead of closing when close button is clicked
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
