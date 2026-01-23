mod installer;
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

// Install multiple files for a skill (supports multi-file skills from GitHub)
#[tauri::command]
async fn install_skill_files(
    files: Vec<(String, String)>,
    skill_name: String,
    tool_ids: Vec<String>,
) -> Result<Vec<String>, String> {
    tools::install_skill_files_to_tools(&files, &skill_name, &tool_ids).await
}

// Install a skill to a specific project directory
#[tauri::command]
async fn install_skill_to_project(
    skill_content: String,
    skill_name: String,
    project_path: String,
    tool_id: String,
) -> Result<String, String> {
    tools::install_skill_to_project(&skill_content, &skill_name, &project_path, &tool_id).await
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

// API base URL - can be overridden via SKILLHUB_API_URL environment variable
// Default: https://www.skillhub.club (production)
// For local development: SKILLHUB_API_URL=http://localhost:3000 npm run tauri dev
const DEFAULT_API_URL: &str = "https://www.skillhub.club";

fn get_api_base_url() -> String {
    std::env::var("SKILLHUB_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.to_string())
}

// Search skills from SkillHub API (using public desktop endpoint)
#[tauri::command]
async fn search_skills(query: String, limit: Option<i32>) -> Result<Vec<SkillHubSkill>, String> {
    let limit = limit.unwrap_or(20);
    let client = reqwest::Client::new();
    let base_url = get_api_base_url();

    let response = client
        .post(format!("{}/api/v1/desktop/search", base_url))
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
    r#type: Option<String>, // "collections" for aggregator repos
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let base_url = get_api_base_url();

    let mut url = format!(
        "{}/api/v1/desktop/catalog?page={}&limit={}",
        base_url,
        page.unwrap_or(1),
        limit.unwrap_or(20)
    );

    if let Some(cat) = category {
        url.push_str(&format!("&category={}", cat));
    }
    if let Some(sort) = sort_by {
        url.push_str(&format!("&sortBy={}", sort));
    }
    if let Some(t) = r#type {
        url.push_str(&format!("&type={}", t));
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

// Get KOL detail with skills from SkillHub API
#[tauri::command]
async fn get_kol_detail(
    username: String,
    include_skills: Option<bool>,
    skills_limit: Option<i32>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let base_url = get_api_base_url();

    let url = format!(
        "{}/api/kol/{}?include_skills={}&skills_limit={}",
        base_url,
        username,
        include_skills.unwrap_or(true),
        skills_limit.unwrap_or(20)
    );

    println!("[get_kol_detail] Fetching: {}", url);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to get KOL detail: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to get KOL detail: HTTP {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// Get KOL list from SkillHub API
#[tauri::command]
async fn get_kol_list(
    limit: Option<i32>,
    offset: Option<i32>,
    sort: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let base_url = get_api_base_url();

    let url = format!(
        "{}/api/kol?limit={}&offset={}&sort={}",
        base_url,
        limit.unwrap_or(20),
        offset.unwrap_or(0),
        sort.unwrap_or_else(|| "followers".to_string())
    );

    println!("[get_kol_list] Fetching: {}", url);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| {
            println!("[get_kol_list] Request failed: {}", e);
            format!("Failed to get KOL list: {}", e)
        })?;

    println!("[get_kol_list] Response status: {}", response.status());

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| {
            println!("[get_kol_list] Parse failed: {}", e);
            format!("Failed to parse response: {}", e)
        })?;

    println!("[get_kol_list] Success, got data");
    Ok(data)
}

// Get skill detail from SkillHub API (using public desktop endpoint)
#[tauri::command]
async fn get_skill_detail(slug: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let base_url = get_api_base_url();

    let response = client
        .get(&format!("{}/api/v1/desktop/skills/{}", base_url, slug))
        .send()
        .await
        .map_err(|e| format!("Failed to get skill detail: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// Get skill files tree structure from SkillHub API
#[tauri::command]
async fn get_skill_files(skill_id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let base_url = get_api_base_url();

    let response = client
        .get(&format!("{}/api/v1/skills/{}/files", base_url, skill_id))
        .send()
        .await
        .map_err(|e| format!("Failed to get skill files: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to get skill files: HTTP {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data)
}

// Get file content from GitHub (proxied through SkillHub API)
#[tauri::command]
async fn get_remote_file_content(raw_url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let base_url = get_api_base_url();

    let response = client
        .get(&format!("{}/api/v1/skills/file-content?url={}", base_url, urlencoding::encode(&raw_url)))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch file content: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch file content: HTTP {}", response.status()));
    }

    let content = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(content)
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

// Claude Code directory structure info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeDirectories {
    pub home: String,
    pub personal_skills: String,      // ~/.claude/skills/
    pub personal_rules: String,       // ~/.claude/rules/
    pub personal_memory: String,      // ~/.claude/CLAUDE.md
    pub personal_commands: String,    // ~/.claude/commands/
}

// Get Claude Code directory paths
#[tauri::command]
fn get_claude_directories() -> Result<ClaudeDirectories, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let claude_dir = home.join(".claude");
    
    Ok(ClaudeDirectories {
        home: home.to_string_lossy().to_string(),
        personal_skills: claude_dir.join("skills").to_string_lossy().to_string(),
        personal_rules: claude_dir.join("rules").to_string_lossy().to_string(),
        personal_memory: claude_dir.join("CLAUDE.md").to_string_lossy().to_string(),
        personal_commands: claude_dir.join("commands").to_string_lossy().to_string(),
    })
}

// Check if a path exists
#[tauri::command]
fn check_path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

// Get directory structure for a specific AI coding tool
#[tauri::command]
async fn get_tool_directories(tool_id: String) -> Result<tools::ToolDirectories, String> {
    tools::get_tool_directories(&tool_id).await
}

// Copy a skill from source to destination directory
#[tauri::command]
async fn copy_skill(source_path: String, dest_dir: String) -> Result<String, String> {
    tools::copy_skill(&source_path, &dest_dir).await
}

// List skills in a directory (for import picker)
#[tauri::command]
async fn list_skills_in_dir(dir_path: String) -> Result<Vec<InstalledSkill>, String> {
    tools::list_skills_in_dir(&dir_path).await
}

// Install skill to ~/.claude/skills/ temporarily for playground
#[tauri::command]
async fn install_temp_skill(skill_name: String, content: String) -> Result<String, String> {
    use tokio::fs;

    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let skills_dir = home.join(".claude").join("skills").join(&skill_name);

    fs::create_dir_all(&skills_dir)
        .await
        .map_err(|e| format!("Failed to create skill dir: {}", e))?;

    let skill_file = skills_dir.join("SKILL.md");
    fs::write(&skill_file, content)
        .await
        .map_err(|e| format!("Failed to write skill: {}", e))?;

    Ok(skills_dir.to_string_lossy().to_string())
}

// Uninstall temp skill from ~/.claude/skills/
#[tauri::command]
async fn uninstall_temp_skill(skill_path: String) -> Result<(), String> {
    use tokio::fs;

    let path = std::path::Path::new(&skill_path);
    if path.exists() && path.is_dir() {
        fs::remove_dir_all(&path)
            .await
            .map_err(|e| format!("Failed to cleanup temp skill: {}", e))?;
    }
    Ok(())
}

// Write skill content to temp file (legacy, kept for compatibility)
#[tauri::command]
async fn write_temp_skill(skill_id: String, content: String) -> Result<String, String> {
    use tokio::fs;

    let temp_dir = std::env::temp_dir().join("skillhub");
    fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let file_path = temp_dir.join(format!("{}.md", skill_id));
    fs::write(&file_path, content)
        .await
        .map_err(|e| format!("Failed to write temp skill: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

// Cleanup temp skill file (legacy)
#[tauri::command]
async fn cleanup_temp_skill(path: String) -> Result<(), String> {
    use tokio::fs;

    if std::path::Path::new(&path).exists() {
        fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to cleanup temp skill: {}", e))?;
    }
    Ok(())
}

// ============================================
// Installer Commands
// ============================================

// Check all dependencies status (Homebrew/winget, Node.js, npm, Claude Code, config)
#[tauri::command]
fn check_dependencies() -> installer::DependencyStatus {
    installer::check_all_dependencies()
}

// Get installation steps for missing dependencies
#[tauri::command]
fn get_install_steps() -> Vec<installer::InstallStep> {
    installer::get_install_steps()
}

// Get a specific installation command
#[tauri::command]
fn get_install_command(step_id: String) -> Result<installer::InstallStep, String> {
    installer::get_install_command(&step_id)
}

// Configure Claude Code to use SkillHub API
#[tauri::command]
async fn configure_claude_code(api_key: String) -> Result<(), String> {
    installer::configure_claude_code(&api_key).await
}

// Remove Claude Code configuration
#[tauri::command]
async fn remove_claude_code_config() -> Result<(), String> {
    installer::remove_claude_code_config().await
}

// Validate API key against SkillHub API
#[tauri::command]
async fn validate_api_key(api_key: String) -> Result<installer::ApiKeyValidationResult, String> {
    installer::validate_api_key(&api_key).await
}

// Get manual installation instructions for a step
#[tauri::command]
fn get_manual_install_instructions(step_id: String) -> installer::ManualInstallInstructions {
    installer::get_manual_install_instructions(&step_id)
}

// Get Claude Code environment variables (for PTY spawn)
#[tauri::command]
fn get_claude_env_vars() -> Vec<(String, String)> {
    installer::get_claude_env_vars()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            detect_tools,
            get_installed_skills,
            install_skill,
            install_skill_files,
            install_skill_to_project,
            uninstall_skill,
            read_skill_content,
            search_skills,
            get_catalog,
            get_kol_list,
            get_kol_detail,
            get_skill_detail,
            get_skill_files,
            get_remote_file_content,
            open_folder,
            get_folder_tree,
            read_file,
            get_claude_directories,
            check_path_exists,
            get_tool_directories,
            copy_skill,
            list_skills_in_dir,
            install_temp_skill,
            uninstall_temp_skill,
            write_temp_skill,
            cleanup_temp_skill,
            // Installer commands
            check_dependencies,
            get_install_steps,
            get_install_command,
            configure_claude_code,
            remove_claude_code_config,
            validate_api_key,
            get_manual_install_instructions,
            get_claude_env_vars,
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
