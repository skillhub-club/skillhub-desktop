use crate::{DetectedTool, InstalledSkill};
use std::path::PathBuf;
use tokio::fs;

// Tool configurations
struct ToolConfig {
    id: &'static str,
    name: &'static str,
    config_paths: &'static [&'static str],
    // Multiple possible skill subpaths (checked in order)
    skills_subpaths: &'static [&'static str],
}

const SUPPORTED_TOOLS: &[ToolConfig] = &[
    // === Front-Runners ===
    ToolConfig {
        id: "claude",
        name: "Claude Code",
        config_paths: &[".claude"],
        // Claude supports: commands/, skills/, and plugins/marketplaces/*/skills/
        skills_subpaths: &["commands", "skills", "plugins/marketplaces"],
    },
    ToolConfig {
        id: "cursor",
        name: "Cursor",
        config_paths: &[".cursor"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "codex",
        name: "Codex (OpenAI)",
        config_paths: &[".codex"],
        // Codex uses prompts/ for custom prompts and skills/ for skills
        skills_subpaths: &["prompts", "skills"],
    },
    ToolConfig {
        id: "copilot",
        name: "GitHub Copilot",
        config_paths: &[".config/github-copilot", ".github-copilot"],
        skills_subpaths: &["instructions"],
    },
    ToolConfig {
        id: "cline",
        name: "Cline",
        config_paths: &[".cline"],
        // Cline primarily uses .clinerules file, but we support commands/ for SkillHub
        skills_subpaths: &["commands"],
    },
    // === Runners-Up ===
    ToolConfig {
        id: "roocode",
        name: "RooCode",
        config_paths: &[".roo", ".roocode"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "windsurf",
        name: "Windsurf",
        config_paths: &[".windsurf", ".codeium/windsurf"],
        // Windsurf uses .windsurfrules file, we support commands/ for SkillHub
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "aider",
        name: "Aider",
        config_paths: &[".aider"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "augment",
        name: "Augment",
        config_paths: &[".augment"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "continue",
        name: "Continue",
        config_paths: &[".continue"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "gemini",
        name: "Gemini CLI",
        config_paths: &[".gemini"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "opencode",
        name: "OpenCode",
        // OpenCode uses ~/.config/opencode/ not ~/.opencode/
        config_paths: &[".config/opencode"],
        skills_subpaths: &["commands", "skill"],
    },
    // === Emerging ===
    ToolConfig {
        id: "kiro",
        name: "AWS Kiro",
        config_paths: &[".kiro"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "kilocode",
        name: "Kilo Code",
        config_paths: &[".kilocode", ".kilo"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "zencoder",
        name: "Zencoder",
        config_paths: &[".zencoder"],
        skills_subpaths: &["commands"],
    },
    // === IDEs ===
    ToolConfig {
        id: "zed",
        name: "Zed",
        config_paths: &[".zed"],
        skills_subpaths: &["commands"],
    },
    ToolConfig {
        id: "vscode",
        name: "VS Code",
        config_paths: &[".vscode"],
        skills_subpaths: &["commands"],
    },
];

fn get_home_dir() -> Option<PathBuf> {
    dirs::home_dir()
}

pub async fn detect_all_tools() -> Result<Vec<DetectedTool>, String> {
    let home = get_home_dir().ok_or("Cannot find home directory")?;
    let mut detected = Vec::new();

    for tool in SUPPORTED_TOOLS {
        for config_path in tool.config_paths {
            let config_dir = home.join(config_path);
            let installed = config_dir.exists();

            if installed {
                // Count skills from all supported subpaths
                let mut total_skills = 0;
                let mut primary_skills_dir = config_dir.join(tool.skills_subpaths[0]);

                for skills_subpath in tool.skills_subpaths {
                    let skills_dir = config_dir.join(skills_subpath);
                    if skills_dir.exists() {
                        total_skills += count_skills(&skills_dir).await.unwrap_or(0);
                        // Use the first existing skills dir as primary
                        if primary_skills_dir == config_dir.join(tool.skills_subpaths[0]) && skills_dir.exists() {
                            primary_skills_dir = skills_dir;
                        }
                    }
                }

                detected.push(DetectedTool {
                    name: tool.name.to_string(),
                    id: tool.id.to_string(),
                    config_path: config_dir.to_string_lossy().to_string(),
                    skills_path: primary_skills_dir.to_string_lossy().to_string(),
                    installed,
                    skills_count: total_skills,
                });
                break; // Found this tool, move to next
            }
        }
    }

    // Also check for tools not installed yet but show them as available
    for tool in SUPPORTED_TOOLS {
        if !detected.iter().any(|d| d.id == tool.id) {
            let config_dir = home.join(tool.config_paths[0]);
            let skills_dir = config_dir.join(tool.skills_subpaths[0]);

            detected.push(DetectedTool {
                name: tool.name.to_string(),
                id: tool.id.to_string(),
                config_path: config_dir.to_string_lossy().to_string(),
                skills_path: skills_dir.to_string_lossy().to_string(),
                installed: false,
                skills_count: 0,
            });
        }
    }

    Ok(detected)
}

async fn count_skills(skills_dir: &PathBuf) -> Result<usize, String> {
    let mut count = 0;

    // Check if this is a marketplace directory (plugins/marketplaces)
    if skills_dir.ends_with("plugins/marketplaces") {
        // Scan marketplace subdirectories for skills
        if let Ok(mut marketplaces) = fs::read_dir(skills_dir).await {
            while let Ok(Some(marketplace)) = marketplaces.next_entry().await {
                let marketplace_path = marketplace.path();
                if marketplace_path.is_dir() {
                    // Check for skills/ subdirectory in marketplace
                    let skills_subdir = marketplace_path.join("skills");
                    if skills_subdir.exists() {
                        count += count_skills_in_dir(&skills_subdir).await;
                    }
                    // Also check for plugins/*/skills/ structure
                    let plugins_dir = marketplace_path.join("plugins");
                    if plugins_dir.exists() {
                        if let Ok(mut plugins) = fs::read_dir(&plugins_dir).await {
                            while let Ok(Some(plugin)) = plugins.next_entry().await {
                                let plugin_skills = plugin.path().join("skills");
                                if plugin_skills.exists() {
                                    count += count_skills_in_dir(&plugin_skills).await;
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        count = count_skills_in_dir(skills_dir).await;
    }

    Ok(count)
}

async fn count_skills_in_dir(dir: &PathBuf) -> usize {
    let mut count = 0;

    if let Ok(mut entries) = fs::read_dir(dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.is_dir() {
                // Check if it has SKILL.md
                if path.join("SKILL.md").exists() {
                    count += 1;
                }
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                // Or is a .md file itself
                count += 1;
            }
        }
    }

    count
}

pub async fn get_skills_for_tool(tool_id: &str) -> Result<Vec<InstalledSkill>, String> {
    let home = get_home_dir().ok_or("Cannot find home directory")?;
    let mut skills = Vec::new();

    let tool = SUPPORTED_TOOLS
        .iter()
        .find(|t| t.id == tool_id)
        .ok_or_else(|| format!("Unknown tool: {}", tool_id))?;

    'outer: for config_path in tool.config_paths {
        let config_dir = home.join(config_path);
        if !config_dir.exists() {
            continue;
        }

        // Check all supported skills subpaths
        for skills_subpath in tool.skills_subpaths {
            let skills_dir = config_dir.join(skills_subpath);

            if !skills_dir.exists() {
                continue;
            }

            // Handle marketplace directory specially
            if *skills_subpath == "plugins/marketplaces" {
                collect_marketplace_skills(&skills_dir, tool_id, &mut skills).await;
            } else {
                collect_skills_from_dir(&skills_dir, tool_id, &mut skills).await;
            }
        }
        // Found config dir, stop looking at alternative config paths
        break 'outer;
    }

    Ok(skills)
}

async fn collect_skills_from_dir(skills_dir: &PathBuf, tool_id: &str, skills: &mut Vec<InstalledSkill>) {
    if let Ok(mut entries) = fs::read_dir(skills_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();

            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    if let Ok(content) = fs::read_to_string(&skill_md).await {
                        let (name, description, author) = parse_skill_md(&content);
                        skills.push(InstalledSkill {
                            name: name.unwrap_or_else(|| {
                                path.file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default()
                            }),
                            path: path.to_string_lossy().to_string(),
                            description,
                            author,
                            tool_id: tool_id.to_string(),
                        });
                    }
                }
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(&path).await {
                    let (name, description, author) = parse_skill_md(&content);
                    skills.push(InstalledSkill {
                        name: name.unwrap_or_else(|| {
                            path.file_stem()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_default()
                        }),
                        path: path.to_string_lossy().to_string(),
                        description,
                        author,
                        tool_id: tool_id.to_string(),
                    });
                }
            }
        }
    }
}

async fn collect_marketplace_skills(marketplaces_dir: &PathBuf, tool_id: &str, skills: &mut Vec<InstalledSkill>) {
    if let Ok(mut marketplaces) = fs::read_dir(marketplaces_dir).await {
        while let Ok(Some(marketplace)) = marketplaces.next_entry().await {
            let marketplace_path = marketplace.path();
            if !marketplace_path.is_dir() {
                continue;
            }

            // Check for skills/ subdirectory in marketplace (e.g., anthropic-agent-skills/skills/)
            let skills_subdir = marketplace_path.join("skills");
            if skills_subdir.exists() {
                collect_skills_from_dir(&skills_subdir, tool_id, skills).await;
            }

            // Also check for plugins/*/skills/ structure (e.g., claude-plugins-official/plugins/*/skills/)
            let plugins_dir = marketplace_path.join("plugins");
            if plugins_dir.exists() {
                if let Ok(mut plugins) = fs::read_dir(&plugins_dir).await {
                    while let Ok(Some(plugin)) = plugins.next_entry().await {
                        let plugin_skills = plugin.path().join("skills");
                        if plugin_skills.exists() {
                            collect_skills_from_dir(&plugin_skills, tool_id, skills).await;
                        }
                    }
                }
            }
        }
    }
}

fn parse_skill_md(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut name = None;
    let mut description = None;
    let mut author = None;

    // Try to parse YAML frontmatter
    if content.starts_with("---") {
        if let Some(end) = content[3..].find("---") {
            let frontmatter = &content[3..end + 3];
            for line in frontmatter.lines() {
                let line = line.trim();
                if line.starts_with("name:") {
                    name = Some(line[5..].trim().trim_matches('"').to_string());
                } else if line.starts_with("description:") {
                    description = Some(line[12..].trim().trim_matches('"').to_string());
                } else if line.starts_with("author:") {
                    author = Some(line[7..].trim().trim_matches('"').to_string());
                }
            }
        }
    }

    // Fallback: try to get name from first heading
    if name.is_none() {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("# ") {
                name = Some(line[2..].to_string());
                break;
            }
        }
    }

    (name, description, author)
}

pub async fn install_skill_to_tools(
    skill_content: &str,
    skill_name: &str,
    tool_ids: &[String],
) -> Result<Vec<String>, String> {
    let home = get_home_dir().ok_or("Cannot find home directory")?;
    let mut installed_paths = Vec::new();

    // Create a safe folder name from skill name
    let folder_name = skill_name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    for tool_id in tool_ids {
        let tool = SUPPORTED_TOOLS
            .iter()
            .find(|t| t.id == tool_id)
            .ok_or_else(|| format!("Unknown tool: {}", tool_id))?;

        // Use the first skills subpath for installation
        let skills_dir = home.join(tool.config_paths[0]).join(tool.skills_subpaths[0]);

        // Create skills directory if it doesn't exist
        if !skills_dir.exists() {
            fs::create_dir_all(&skills_dir)
                .await
                .map_err(|e| format!("Failed to create skills directory: {}", e))?;
        }

        let skill_dir = skills_dir.join(&folder_name);
        fs::create_dir_all(&skill_dir)
            .await
            .map_err(|e| format!("Failed to create skill directory: {}", e))?;

        let skill_file = skill_dir.join("SKILL.md");
        fs::write(&skill_file, skill_content)
            .await
            .map_err(|e| format!("Failed to write skill file: {}", e))?;

        installed_paths.push(skill_file.to_string_lossy().to_string());
    }

    Ok(installed_paths)
}

pub async fn uninstall_skill(skill_path: &str) -> Result<(), String> {
    let path = PathBuf::from(skill_path);

    if path.is_dir() {
        fs::remove_dir_all(&path)
            .await
            .map_err(|e| format!("Failed to remove skill directory: {}", e))?;
    } else if path.is_file() {
        // If it's a file, remove the parent directory if it only contains this file
        let parent = path.parent().ok_or("Invalid path")?;
        fs::remove_file(&path)
            .await
            .map_err(|e| format!("Failed to remove skill file: {}", e))?;

        // Try to remove parent if empty
        let _ = fs::remove_dir(parent).await;
    }

    Ok(())
}

/// Read skill content from a path (for syncing between tools)
pub async fn read_skill_content(skill_path: &str) -> Result<String, String> {
    let path = PathBuf::from(skill_path);

    if path.is_dir() {
        // Read SKILL.md from directory
        let skill_file = path.join("SKILL.md");
        if skill_file.exists() {
            fs::read_to_string(&skill_file)
                .await
                .map_err(|e| format!("Failed to read skill file: {}", e))
        } else {
            Err("SKILL.md not found in directory".to_string())
        }
    } else if path.is_file() {
        fs::read_to_string(&path)
            .await
            .map_err(|e| format!("Failed to read skill file: {}", e))
    } else {
        Err("Skill path does not exist".to_string())
    }
}

/// Open a folder in the system file explorer
pub fn open_folder_in_explorer(path: &str) -> Result<(), String> {
    let path_buf = PathBuf::from(path);

    // Create directory if it doesn't exist
    if !path_buf.exists() {
        std::fs::create_dir_all(&path_buf)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

/// File tree node for visualization
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
    pub content: Option<String>,
    pub metadata: Option<SkillMetadata>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SkillMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub category: Option<String>,
}

/// Get the file tree structure for a skills folder
pub async fn get_folder_tree(path: &str, max_depth: usize) -> Result<FileNode, String> {
    let path_buf = PathBuf::from(path);

    if !path_buf.exists() {
        // Create directory if it doesn't exist
        std::fs::create_dir_all(&path_buf)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    build_tree(&path_buf, 0, max_depth).await
}

#[async_recursion::async_recursion]
async fn build_tree(path: &PathBuf, current_depth: usize, max_depth: usize) -> Result<FileNode, String> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let is_dir = path.is_dir();

    if !is_dir {
        // It's a file - read content if it's a markdown file
        let content = if path.extension().map(|e| e == "md").unwrap_or(false) {
            fs::read_to_string(path).await.ok()
        } else {
            None
        };

        let metadata = content.as_ref().map(|c| extract_metadata(c));

        return Ok(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir: false,
            children: None,
            content,
            metadata,
        });
    }

    // It's a directory
    let mut children = Vec::new();

    if current_depth < max_depth {
        if let Ok(mut entries) = fs::read_dir(path).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let entry_path = entry.path();
                // Skip hidden files/folders
                if entry_path.file_name()
                    .map(|n| n.to_string_lossy().starts_with('.'))
                    .unwrap_or(false)
                {
                    continue;
                }

                if let Ok(child) = build_tree(&entry_path, current_depth + 1, max_depth).await {
                    children.push(child);
                }
            }
        }

        // Sort: directories first, then by name
        children.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });
    }

    Ok(FileNode {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir: true,
        children: Some(children),
        content: None,
        metadata: None,
    })
}

fn extract_metadata(content: &str) -> SkillMetadata {
    let mut name = None;
    let mut description = None;
    let mut author = None;
    let mut category = None;

    // Try to parse YAML frontmatter
    if content.starts_with("---") {
        if let Some(end) = content[3..].find("---") {
            let frontmatter = &content[3..end + 3];
            for line in frontmatter.lines() {
                let line = line.trim();
                if line.starts_with("name:") {
                    name = Some(line[5..].trim().trim_matches('"').to_string());
                } else if line.starts_with("description:") {
                    description = Some(line[12..].trim().trim_matches('"').to_string());
                } else if line.starts_with("author:") {
                    author = Some(line[7..].trim().trim_matches('"').to_string());
                } else if line.starts_with("category:") {
                    category = Some(line[9..].trim().trim_matches('"').to_string());
                }
            }
        }
    }

    // Fallback: try to get name from first heading
    if name.is_none() {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("# ") {
                name = Some(line[2..].to_string());
                break;
            }
        }
    }

    SkillMetadata {
        name,
        description,
        author,
        category,
    }
}

/// Read a single file's content
pub async fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}
