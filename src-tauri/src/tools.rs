use crate::{DetectedTool, InstalledSkill};
use std::path::PathBuf;
use tokio::fs;

// Tool configurations based on OFFICIAL documentation:
// - Claude Code: https://code.claude.com/docs/en/skills
//   Personal: ~/.claude/skills/, Project: .claude/skills/
// - Codex (OpenAI): https://developers.openai.com/codex/skills/
//   User: ~/.codex/skills/, Repo: .codex/skills/, Admin: /etc/codex/skills/
// - Cline: https://docs.cline.bot/features/skills
//   Global: ~/.cline/skills/, Project: .cline/skills/
// - Cursor: https://cursor.com/docs/context/rules (v2.3.35+ uses .cursor/skills/)
//   Project: .cursor/skills/ or .cursor/rules/
// - OpenCode: https://opencode.ai/docs/skills
//   Global: ~/.config/opencode/skills/, Project: .opencode/skills/
//   Also supports Claude-compatible: ~/.claude/skills/, .claude/skills/
// - GitHub Copilot (VS Code):
//   Personal: ~/.copilot/skills/ (recommended), ~/.claude/skills/ (legacy)
//   Project: .github/skills/ (recommended), .claude/skills/ (legacy)
// - Gemini CLI: Similar to Claude Code structure
//   User: ~/.gemini/skills/, Workspace: .gemini/skills/
// - Windsurf: https://docs.windsurf.com/windsurf/cascade/memories
//   Project only: .windsurf/rules/ (no global ~/.windsurf path officially supported)

struct ToolConfig {
    id: &'static str,
    name: &'static str,
    config_paths: &'static [&'static str],
    // Primary skills directory (for display and installation)
    primary_subpath: &'static str,
    // All subpaths to scan for counting skills
    all_subpaths: &'static [&'static str],
}

const SUPPORTED_TOOLS: &[ToolConfig] = &[
    // Claude Code: ~/.claude/skills/
    // Personal: ~/.claude/skills/, Project: .claude/skills/
    ToolConfig {
        id: "claude",
        name: "Claude Code",
        config_paths: &[".claude"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Codex: ~/.codex/skills/
    // USER: ~/.codex/skills/, REPO: .codex/skills/, ADMIN: /etc/codex/skills/
    ToolConfig {
        id: "codex",
        name: "Codex (OpenAI)",
        config_paths: &[".codex"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Cursor: ~/.cursor/skills/ (v2.3.35+)
    ToolConfig {
        id: "cursor",
        name: "Cursor",
        config_paths: &[".cursor"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Cline: ~/.cline/skills/
    // Global: ~/.cline/skills/, Project: .cline/skills/
    ToolConfig {
        id: "cline",
        name: "Cline",
        config_paths: &[".cline"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // OpenCode: ~/.config/opencode/skills/
    // Also supports .claude/skills/ for compatibility
    ToolConfig {
        id: "opencode",
        name: "OpenCode",
        config_paths: &[".config/opencode"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Gemini CLI: ~/.gemini/skills/
    // User: ~/.gemini/skills/, Workspace: .gemini/skills/
    ToolConfig {
        id: "gemini",
        name: "Gemini CLI",
        config_paths: &[".gemini"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Kilo Code: ~/.kilocode/skills/
    // Also has mode-specific: skills-code/, skills-architect/
    ToolConfig {
        id: "kilocode",
        name: "Kilo Code",
        config_paths: &[".kilocode", ".kilo"],
        primary_subpath: "skills",
        all_subpaths: &["skills", "skills-code", "skills-architect"],
    },
    // GitHub Copilot (VS Code): ~/.copilot/skills/ (recommended)
    // Also supports ~/.claude/skills/ for legacy compatibility
    // Project: .github/skills/ or .claude/skills/
    ToolConfig {
        id: "copilot",
        name: "GitHub Copilot",
        config_paths: &[".copilot"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Windsurf: ~/.windsurf/rules/ (uses rules, not skills)
    ToolConfig {
        id: "windsurf",
        name: "Windsurf",
        config_paths: &[".windsurf", ".codeium/windsurf"],
        primary_subpath: "rules",
        all_subpaths: &["rules"],
    },
    // RooCode: ~/.roo/skills/
    ToolConfig {
        id: "roocode",
        name: "RooCode",
        config_paths: &[".roo", ".roocode"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Aider: No official skills support
    ToolConfig {
        id: "aider",
        name: "Aider",
        config_paths: &[".aider"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Augment: ~/.augment/skills/
    ToolConfig {
        id: "augment",
        name: "Augment",
        config_paths: &[".augment"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Continue: uses rules (not skills)
    // ToolConfig {
    //     id: "continue",
    //     name: "Continue",
    //     config_paths: &[".continue"],
    //     primary_subpath: "rules",
    //     all_subpaths: &["rules"],
    // },
    // AWS Kiro: ~/.kiro/skills/
    ToolConfig {
        id: "kiro",
        name: "AWS Kiro",
        config_paths: &[".kiro"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Zencoder: ~/.zencoder/skills/
    ToolConfig {
        id: "zencoder",
        name: "Zencoder",
        config_paths: &[".zencoder"],
        primary_subpath: "skills",
        all_subpaths: &["skills"],
    },
    // Zed: uses rules (not skills)
    ToolConfig {
        id: "zed",
        name: "Zed",
        config_paths: &[".zed"],
        primary_subpath: "rules",
        all_subpaths: &["rules"],
    },
    // Note: VS Code uses GitHub Copilot for skills, so no separate vscode entry needed
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

                for subpath in tool.all_subpaths {
                    let skills_dir = config_dir.join(subpath);
                    if skills_dir.exists() {
                        total_skills += count_skills(&skills_dir).await.unwrap_or(0);
                    }
                }

                // Use the primary subpath for display
                let primary_dir = if tool.primary_subpath == "." {
                    config_dir.clone()
                } else {
                    config_dir.join(tool.primary_subpath)
                };

                detected.push(DetectedTool {
                    name: tool.name.to_string(),
                    id: tool.id.to_string(),
                    config_path: config_dir.to_string_lossy().to_string(),
                    skills_path: primary_dir.to_string_lossy().to_string(),
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
            let primary_dir = if tool.primary_subpath == "." {
                config_dir.clone()
            } else {
                config_dir.join(tool.primary_subpath)
            };

            detected.push(DetectedTool {
                name: tool.name.to_string(),
                id: tool.id.to_string(),
                config_path: config_dir.to_string_lossy().to_string(),
                skills_path: primary_dir.to_string_lossy().to_string(),
                installed: false,
                skills_count: 0,
            });
        }
    }

    Ok(detected)
}

async fn count_skills(skills_dir: &PathBuf) -> Result<usize, String> {
    let count = count_skills_in_dir(skills_dir).await;
    Ok(count)
}

async fn count_skills_in_dir(dir: &PathBuf) -> usize {
    let mut count = 0;

    if let Ok(mut entries) = fs::read_dir(dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            // Skip hidden files/directories
            if path.file_name()
                .map(|n| n.to_string_lossy().starts_with('.'))
                .unwrap_or(false)
            {
                continue;
            }
            
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
        for subpath in tool.all_subpaths {
            let skills_dir = config_dir.join(subpath);

            if !skills_dir.exists() {
                continue;
            }

            collect_skills_from_dir(&skills_dir, tool_id, &mut skills).await;
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
            
            // Skip hidden files/directories
            if path.file_name()
                .map(|n| n.to_string_lossy().starts_with('.'))
                .unwrap_or(false)
            {
                continue;
            }

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

        // Use the primary subpath for installation
        let skills_dir = if tool.primary_subpath == "." {
            home.join(tool.config_paths[0])
        } else {
            home.join(tool.config_paths[0]).join(tool.primary_subpath)
        };

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

/// Install a skill to a specific project directory
pub async fn install_skill_to_project(
    skill_content: &str,
    skill_name: &str,
    project_path: &str,
    tool_id: &str,
) -> Result<String, String> {
    let project_dir = PathBuf::from(project_path);
    
    if !project_dir.exists() {
        return Err(format!("Project directory does not exist: {}", project_path));
    }

    let tool = SUPPORTED_TOOLS
        .iter()
        .find(|t| t.id == tool_id)
        .ok_or_else(|| format!("Unknown tool: {}", tool_id))?;

    // Create a safe folder name from skill name
    let folder_name = skill_name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();

    // Build the project skills directory path
    // e.g., /path/to/project/.claude/skills/skill-name/SKILL.md
    let config_folder = tool.config_paths[0].trim_start_matches('.');
    let skills_dir = if tool.primary_subpath == "." {
        project_dir.join(config_folder)
    } else {
        project_dir.join(config_folder).join(tool.primary_subpath)
    };

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

    Ok(skill_file.to_string_lossy().to_string())
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

/// Install multiple files for a skill (supports multi-file skills)
/// files: Vec<(relative_path, content)>
pub async fn install_skill_files_to_tools(
    files: &[(String, String)],
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

        // Use the primary subpath for installation
        let skills_dir = if tool.primary_subpath == "." {
            home.join(tool.config_paths[0])
        } else {
            home.join(tool.config_paths[0]).join(tool.primary_subpath)
        };

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

        // Install each file
        for (relative_path, content) in files {
            let file_path = skill_dir.join(relative_path);
            
            // Create parent directories if needed
            if let Some(parent) = file_path.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .await
                        .map_err(|e| format!("Failed to create directory: {}", e))?;
                }
            }
            
            fs::write(&file_path, content)
                .await
                .map_err(|e| format!("Failed to write file {}: {}", relative_path, e))?;
        }

        installed_paths.push(skill_dir.to_string_lossy().to_string());
    }

    Ok(installed_paths)
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
        // It's a file - read content for text files
        let text_extensions = [
            "md", "mdx", "txt", "json", "yaml", "yml", "toml", "ini", "xml",
            "py", "js", "ts", "jsx", "tsx", "rs", "go", "rb", "java", "kt", "scala",
            "c", "cpp", "h", "hpp", "cs", "php", "swift", "sh", "bash", "zsh",
            "sql", "graphql", "css", "scss", "less", "html", "vue", "svelte",
            "mdc", "cursorrules", "env", "gitignore", "dockerignore",
        ];
        
        let should_read = path.extension()
            .map(|e| text_extensions.contains(&e.to_string_lossy().to_lowercase().as_str()))
            .unwrap_or(false)
            || path.file_name()
                .map(|n| {
                    let name = n.to_string_lossy().to_lowercase();
                    name == "dockerfile" || name == "makefile" || name == ".gitignore" || name == ".env"
                })
                .unwrap_or(false);
        
        let content = if should_read {
            fs::read_to_string(path).await.ok()
        } else {
            None
        };

        let metadata = if path.extension().map(|e| e == "md").unwrap_or(false) {
            content.as_ref().map(|c| extract_metadata(c))
        } else {
            None
        };

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

/// Tool directory info for a specific tool
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolDirectoryInfo {
    pub name: String,
    pub description: String,
    pub path: String,
    pub icon: String,
    pub is_file: bool,
    pub dir_type: String,
    pub skill_count: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolDirectories {
    pub tool_id: String,
    pub tool_name: String,
    pub home: String,
    pub config_path: String,
    pub directories: Vec<ToolDirectoryInfo>,
    pub installed: bool,
}

/// Get directory structure for a specific tool
pub async fn get_tool_directories(tool_id: &str) -> Result<ToolDirectories, String> {
    let home = get_home_dir().ok_or("Cannot find home directory")?;
    
    let tool = SUPPORTED_TOOLS
        .iter()
        .find(|t| t.id == tool_id)
        .ok_or_else(|| format!("Unknown tool: {}", tool_id))?;
    
    let config_path = home.join(tool.config_paths[0]);
    let installed = config_path.exists();
    
    // Helper to create directory info with skill count
    async fn make_dir_info(
        name: &str,
        description: &str,
        path: PathBuf,
        icon: &str,
        is_file: bool,
        dir_type: &str,
    ) -> ToolDirectoryInfo {
        let skill_count = if is_file {
            if path.exists() { 1 } else { 0 }
        } else {
            count_skills_in_dir(&path).await
        };
        
        ToolDirectoryInfo {
            name: name.to_string(),
            description: description.to_string(),
            path: path.to_string_lossy().to_string(),
            icon: icon.to_string(),
            is_file,
            dir_type: dir_type.to_string(),
            skill_count,
        }
    }
    
    // Simplified: Only show skills directory for each tool
    // Use the primary_subpath to determine the correct directory name
    let dir_name = tool.primary_subpath;
    let (label, description) = match dir_name {
        "skills" => ("Skills", "Agent skills with SKILL.md files"),
        "rules" => ("Rules", "Rules with SKILL.md or *.md files"),
        "instructions" => ("Instructions", "Custom instructions"),
        _ => ("Skills", "Agent skills with SKILL.md files"),
    };

    let directories = match tool_id {
        // Kilo Code has mode-specific skill directories
        "kilocode" => vec![
            make_dir_info(
                "Skills",
                "Generic skills for all modes",
                config_path.join("skills"),
                "package",
                false,
                "skills",
            ).await,
            make_dir_info(
                "Skills (Code Mode)",
                "Skills only for Code mode",
                config_path.join("skills-code"),
                "package",
                false,
                "skills-code",
            ).await,
            make_dir_info(
                "Skills (Architect Mode)",
                "Skills only for Architect mode",
                config_path.join("skills-architect"),
                "package",
                false,
                "skills-architect",
            ).await,
        ],
        // All other tools: just show the primary skills directory
        _ => vec![
            make_dir_info(
                label,
                description,
                config_path.join(dir_name),
                "package",
                false,
                dir_name,
            ).await,
        ],
    };
    
    Ok(ToolDirectories {
        tool_id: tool_id.to_string(),
        tool_name: tool.name.to_string(),
        home: home.to_string_lossy().to_string(),
        config_path: config_path.to_string_lossy().to_string(),
        directories,
        installed,
    })
}

/// Read a single file's content
pub async fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Copy a skill from source to destination
/// Handles both folder-based skills and single .md file skills
pub async fn copy_skill(source_path: &str, dest_dir: &str) -> Result<String, String> {
    let source = PathBuf::from(source_path);
    let dest_base = PathBuf::from(dest_dir);

    // Ensure destination directory exists
    if !dest_base.exists() {
        fs::create_dir_all(&dest_base)
            .await
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }

    let skill_name = source.file_name()
        .ok_or("Invalid source path")?
        .to_string_lossy()
        .to_string();

    let dest_path = dest_base.join(&skill_name);

    // Check if destination already exists
    if dest_path.exists() {
        return Err(format!("Skill '{}' already exists in destination", skill_name));
    }

    if source.is_dir() {
        // Copy entire directory recursively
        copy_dir_recursive(&source, &dest_path).await?;
    } else {
        // Copy single file
        fs::copy(&source, &dest_path)
            .await
            .map_err(|e| format!("Failed to copy file: {}", e))?;
    }

    Ok(dest_path.to_string_lossy().to_string())
}

/// Recursively copy a directory
#[async_recursion::async_recursion]
async fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let mut entries = fs::read_dir(src)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let entry_path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if entry_path.is_dir() {
            copy_dir_recursive(&entry_path, &dest_path).await?;
        } else {
            fs::copy(&entry_path, &dest_path)
                .await
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

/// List skills in a directory (for import picker)
pub async fn list_skills_in_dir(dir_path: &str) -> Result<Vec<InstalledSkill>, String> {
    let path = PathBuf::from(dir_path);

    if !path.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();
    collect_skills_from_dir(&path, "temp", &mut skills).await;

    Ok(skills)
}
