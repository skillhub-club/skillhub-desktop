// Claude Code dependency detection and installation module
// Supports macOS (Homebrew) and Windows (winget)

use serde::{Deserialize, Serialize};
use std::process::Command;
use tokio::fs;

// ============================================
// Data Structures
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub package_manager: DependencyInfo,
    pub node: DependencyInfo,
    pub npm: DependencyInfo,
    pub claude_code: DependencyInfo,
    pub config: ConfigStatus,
    pub platform: String,
    pub all_ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyInfo {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigStatus {
    pub base_url: Option<String>,
    pub api_key_set: bool,
    pub api_key_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallStep {
    pub id: String,
    pub name: String,
    pub description: String,
    pub command: String,
    pub shell: String,
    pub requires_sudo: bool,
    pub skip_reason: Option<String>,
}

// ============================================
// Platform Detection
// ============================================

fn get_platform() -> String {
    if cfg!(target_os = "macos") {
        "macos".to_string()
    } else if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "linux") {
        "linux".to_string()
    } else {
        "unknown".to_string()
    }
}

// ============================================
// Dependency Checks
// ============================================

fn check_command_exists(cmd: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    let which_cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let which_cmd = "which";

    let output = Command::new(which_cmd).arg(cmd).output().ok()?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()?
            .trim()
            .to_string();
        Some(path)
    } else {
        None
    }
}

fn get_command_version(cmd: &str, version_flag: &str) -> Option<String> {
    let output = Command::new(cmd).arg(version_flag).output().ok()?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .map(|s| s.trim().to_string())?;
        Some(version)
    } else {
        None
    }
}

fn check_homebrew() -> DependencyInfo {
    let path = check_command_exists("brew");
    let installed = path.is_some();
    let version = if installed {
        get_command_version("brew", "--version")
            .map(|v| v.replace("Homebrew ", "").split_whitespace().next().unwrap_or("").to_string())
    } else {
        None
    };

    DependencyInfo {
        name: "Homebrew".to_string(),
        installed,
        version,
        path,
        required: true,
    }
}

fn check_winget() -> DependencyInfo {
    let path = check_command_exists("winget");
    let installed = path.is_some();
    let version = if installed {
        get_command_version("winget", "--version")
    } else {
        None
    };

    DependencyInfo {
        name: "winget".to_string(),
        installed,
        version,
        path,
        required: false, // winget is built-in on Windows 10/11
    }
}

fn check_node() -> DependencyInfo {
    let path = check_command_exists("node");
    let installed = path.is_some();
    let version = if installed {
        get_command_version("node", "--version")
    } else {
        None
    };

    DependencyInfo {
        name: "Node.js".to_string(),
        installed,
        version,
        path,
        required: true,
    }
}

fn check_npm() -> DependencyInfo {
    let path = check_command_exists("npm");
    let installed = path.is_some();
    let version = if installed {
        get_command_version("npm", "--version")
    } else {
        None
    };

    DependencyInfo {
        name: "npm".to_string(),
        installed,
        version,
        path,
        required: true,
    }
}

fn check_claude_code() -> DependencyInfo {
    let path = check_command_exists("claude");
    let installed = path.is_some();
    let version = if installed {
        // claude --version might output something like "claude-code version 1.0.0"
        get_command_version("claude", "--version")
            .map(|v| {
                // Try to extract just the version number
                v.split_whitespace()
                    .last()
                    .unwrap_or(&v)
                    .to_string()
            })
    } else {
        None
    };

    DependencyInfo {
        name: "Claude Code".to_string(),
        installed,
        version,
        path,
        required: true,
    }
}

// ============================================
// Config Detection
// ============================================

fn check_config() -> ConfigStatus {
    // First check our local config file (primary source)
    let local_config = read_skillhub_config();
    
    if local_config.anthropic_api_key.is_some() {
        let api_key = local_config.anthropic_api_key.clone().unwrap();
        let api_key_preview = if api_key.len() > 20 {
            Some(format!("{}...{}", &api_key[..12], &api_key[api_key.len()-4..]))
        } else {
            Some(api_key)
        };
        
        return ConfigStatus {
            base_url: local_config.anthropic_base_url,
            api_key_set: true,
            api_key_preview,
        };
    }
    
    // Fallback to shell config / environment variables
    let platform = get_platform();
    if platform == "windows" {
        check_config_windows()
    } else {
        check_config_unix()
    }
}

fn check_config_unix() -> ConfigStatus {
    // Check shell config files for ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY
    let home = dirs::home_dir();
    if home.is_none() {
        return ConfigStatus {
            base_url: None,
            api_key_set: false,
            api_key_preview: None,
        };
    }
    let home = home.unwrap();

    // Check common shell config files
    let config_files = vec![
        home.join(".zshrc"),
        home.join(".bashrc"),
        home.join(".bash_profile"),
        home.join(".profile"),
    ];

    let mut base_url: Option<String> = None;
    let mut api_key: Option<String> = None;

    for config_file in config_files {
        if let Ok(content) = std::fs::read_to_string(&config_file) {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with("export ANTHROPIC_BASE_URL=") {
                    let value = line
                        .strip_prefix("export ANTHROPIC_BASE_URL=")
                        .unwrap_or("")
                        .trim_matches('"')
                        .trim_matches('\'')
                        .to_string();
                    if !value.is_empty() {
                        base_url = Some(value);
                    }
                }
                if line.starts_with("export ANTHROPIC_API_KEY=") {
                    let value = line
                        .strip_prefix("export ANTHROPIC_API_KEY=")
                        .unwrap_or("")
                        .trim_matches('"')
                        .trim_matches('\'')
                        .to_string();
                    if !value.is_empty() {
                        api_key = Some(value);
                    }
                }
            }
        }
    }

    // Also check environment variables (in case they're set elsewhere)
    if base_url.is_none() {
        base_url = std::env::var("ANTHROPIC_BASE_URL").ok();
    }
    if api_key.is_none() {
        api_key = std::env::var("ANTHROPIC_API_KEY").ok();
    }

    let api_key_set = api_key.is_some();
    let api_key_preview = api_key.map(|k| {
        if k.len() > 20 {
            format!("{}...{}", &k[..12], &k[k.len()-4..])
        } else {
            k
        }
    });

    ConfigStatus {
        base_url,
        api_key_set,
        api_key_preview,
    }
}

fn check_config_windows() -> ConfigStatus {
    // Check Windows user environment variables
    let base_url = std::env::var("ANTHROPIC_BASE_URL").ok();
    let api_key = std::env::var("ANTHROPIC_API_KEY").ok();

    let api_key_set = api_key.is_some();
    let api_key_preview = api_key.map(|k| {
        if k.len() > 20 {
            format!("{}...{}", &k[..12], &k[k.len()-4..])
        } else {
            k
        }
    });

    ConfigStatus {
        base_url,
        api_key_set,
        api_key_preview,
    }
}

// ============================================
// Main Check Function
// ============================================

pub fn check_all_dependencies() -> DependencyStatus {
    let platform = get_platform();

    let package_manager = if platform == "macos" || platform == "linux" {
        check_homebrew()
    } else {
        check_winget()
    };

    let node = check_node();
    let npm = check_npm();
    let claude_code = check_claude_code();
    let config = check_config();

    // All ready = all required dependencies installed + config set
    let all_ready = (!package_manager.required || package_manager.installed)
        && node.installed
        && npm.installed
        && claude_code.installed
        && config.api_key_set
        && config.base_url.is_some();

    DependencyStatus {
        package_manager,
        node,
        npm,
        claude_code,
        config,
        platform,
        all_ready,
    }
}

// ============================================
// Install Steps
// ============================================

pub fn get_install_steps() -> Vec<InstallStep> {
    let platform = get_platform();
    let status = check_all_dependencies();

    let mut steps = Vec::new();

    // Package manager (macOS/Linux only)
    if platform == "macos" || platform == "linux" {
        if !status.package_manager.installed {
            steps.push(InstallStep {
                id: "homebrew".to_string(),
                name: "Homebrew".to_string(),
                description: "Package manager for macOS/Linux".to_string(),
                command: r#"/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)""#.to_string(),
                shell: "bash".to_string(),
                requires_sudo: true,
                skip_reason: None,
            });
        } else {
            steps.push(InstallStep {
                id: "homebrew".to_string(),
                name: "Homebrew".to_string(),
                description: "Package manager for macOS/Linux".to_string(),
                command: String::new(),
                shell: "bash".to_string(),
                requires_sudo: false,
                skip_reason: Some(format!("Already installed ({})", status.package_manager.version.unwrap_or_default())),
            });
        }
    }

    // Node.js
    if !status.node.installed {
        let (command, shell) = if platform == "windows" {
            ("winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements".to_string(), "powershell".to_string())
        } else {
            ("brew install node".to_string(), "bash".to_string())
        };

        steps.push(InstallStep {
            id: "node".to_string(),
            name: "Node.js".to_string(),
            description: "JavaScript runtime required for Claude Code".to_string(),
            command,
            shell,
            requires_sudo: false,
            skip_reason: None,
        });
    } else {
        steps.push(InstallStep {
            id: "node".to_string(),
            name: "Node.js".to_string(),
            description: "JavaScript runtime required for Claude Code".to_string(),
            command: String::new(),
            shell: "bash".to_string(),
            requires_sudo: false,
            skip_reason: Some(format!("Already installed ({})", status.node.version.unwrap_or_default())),
        });
    }

    // Claude Code
    if !status.claude_code.installed {
        let (command, shell) = if platform == "windows" {
            ("npm install -g @anthropic-ai/claude-code".to_string(), "powershell".to_string())
        } else {
            ("npm install -g @anthropic-ai/claude-code".to_string(), "bash".to_string())
        };

        steps.push(InstallStep {
            id: "claude_code".to_string(),
            name: "Claude Code".to_string(),
            description: "AI coding assistant CLI".to_string(),
            command,
            shell,
            requires_sudo: false,
            skip_reason: None,
        });
    } else {
        steps.push(InstallStep {
            id: "claude_code".to_string(),
            name: "Claude Code".to_string(),
            description: "AI coding assistant CLI".to_string(),
            command: String::new(),
            shell: "bash".to_string(),
            requires_sudo: false,
            skip_reason: Some(format!("Already installed ({})", status.claude_code.version.unwrap_or_default())),
        });
    }

    steps
}

pub fn get_install_command(step_id: &str) -> Result<InstallStep, String> {
    let steps = get_install_steps();
    steps
        .into_iter()
        .find(|s| s.id == step_id)
        .ok_or_else(|| format!("Unknown step: {}", step_id))
}

// ============================================
// Configuration
// ============================================

const SKILLHUB_BASE_URL: &str = "https://www.skillhub.club/api/v1/anthropic";

/// SkillHub local config structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SkillHubConfig {
    pub anthropic_base_url: Option<String>,
    pub anthropic_api_key: Option<String>,
}

/// Get the SkillHub config directory path
fn get_skillhub_config_dir() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".skillhub"))
}

/// Get the SkillHub config file path
fn get_skillhub_config_path() -> Result<std::path::PathBuf, String> {
    Ok(get_skillhub_config_dir()?.join("config.json"))
}

/// Read SkillHub config from local file
pub fn read_skillhub_config() -> SkillHubConfig {
    let config_path = match get_skillhub_config_path() {
        Ok(p) => p,
        Err(_) => return SkillHubConfig::default(),
    };

    if !config_path.exists() {
        return SkillHubConfig::default();
    }

    match std::fs::read_to_string(&config_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => SkillHubConfig::default(),
    }
}

/// Save SkillHub config to local file
pub async fn save_skillhub_config(config: &SkillHubConfig) -> Result<(), String> {
    let config_dir = get_skillhub_config_dir()?;
    let config_path = get_skillhub_config_path()?;

    // Create config directory if needed
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .await
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Write config
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, content)
        .await
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Get the Claude Code environment variables (for PTY spawn)
pub fn get_claude_env_vars() -> Vec<(String, String)> {
    let config = read_skillhub_config();
    let mut env_vars = Vec::new();

    if let Some(base_url) = config.anthropic_base_url {
        env_vars.push(("ANTHROPIC_BASE_URL".to_string(), base_url));
    }
    if let Some(api_key) = config.anthropic_api_key {
        env_vars.push(("ANTHROPIC_API_KEY".to_string(), api_key));
    }

    env_vars
}

pub async fn configure_claude_code(api_key: &str) -> Result<(), String> {
    // 1. Save to local config file (for immediate use)
    let config = SkillHubConfig {
        anthropic_base_url: Some(SKILLHUB_BASE_URL.to_string()),
        anthropic_api_key: Some(api_key.to_string()),
    };
    save_skillhub_config(&config).await?;

    // 2. Also write to shell config (for terminal use)
    let platform = get_platform();
    if platform == "windows" {
        configure_claude_code_windows(api_key).await
    } else {
        configure_claude_code_unix(api_key).await
    }
}

async fn configure_claude_code_unix(api_key: &str) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    
    // Detect the user's shell and choose the appropriate config file
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let config_file = if shell.contains("zsh") {
        home.join(".zshrc")
    } else if shell.contains("bash") {
        // On macOS, .bash_profile is preferred for login shells
        if cfg!(target_os = "macos") {
            home.join(".bash_profile")
        } else {
            home.join(".bashrc")
        }
    } else {
        home.join(".profile")
    };

    // Read existing content
    let existing_content = fs::read_to_string(&config_file)
        .await
        .unwrap_or_default();

    // Remove any existing ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY lines
    let filtered_lines: Vec<&str> = existing_content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.starts_with("export ANTHROPIC_BASE_URL=")
                && !trimmed.starts_with("export ANTHROPIC_API_KEY=")
                && !trimmed.contains("# SkillHub Claude Code Configuration")
        })
        .collect();

    // Build new content
    let mut new_content = filtered_lines.join("\n");
    
    // Ensure there's a newline at the end
    if !new_content.ends_with('\n') {
        new_content.push('\n');
    }

    // Add SkillHub configuration
    new_content.push_str("\n# SkillHub Claude Code Configuration\n");
    new_content.push_str(&format!("export ANTHROPIC_BASE_URL=\"{}\"\n", SKILLHUB_BASE_URL));
    new_content.push_str(&format!("export ANTHROPIC_API_KEY=\"{}\"\n", api_key));

    // Write back
    fs::write(&config_file, new_content)
        .await
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}

async fn configure_claude_code_windows(api_key: &str) -> Result<(), String> {
    // Use PowerShell to set user environment variables
    let set_base_url = Command::new("powershell")
        .args([
            "-Command",
            &format!(
                "[Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', '{}', 'User')",
                SKILLHUB_BASE_URL
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to set ANTHROPIC_BASE_URL: {}", e))?;

    if !set_base_url.status.success() {
        return Err(format!(
            "Failed to set ANTHROPIC_BASE_URL: {}",
            String::from_utf8_lossy(&set_base_url.stderr)
        ));
    }

    let set_api_key = Command::new("powershell")
        .args([
            "-Command",
            &format!(
                "[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', '{}', 'User')",
                api_key
            ),
        ])
        .output()
        .map_err(|e| format!("Failed to set ANTHROPIC_API_KEY: {}", e))?;

    if !set_api_key.status.success() {
        return Err(format!(
            "Failed to set ANTHROPIC_API_KEY: {}",
            String::from_utf8_lossy(&set_api_key.stderr)
        ));
    }

    Ok(())
}

pub async fn remove_claude_code_config() -> Result<(), String> {
    let platform = get_platform();

    if platform == "windows" {
        remove_claude_code_config_windows().await
    } else {
        remove_claude_code_config_unix().await
    }
}

async fn remove_claude_code_config_unix() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;

    // Check all common shell config files
    let config_files = vec![
        home.join(".zshrc"),
        home.join(".bashrc"),
        home.join(".bash_profile"),
        home.join(".profile"),
    ];

    for config_file in config_files {
        if !config_file.exists() {
            continue;
        }

        let content = fs::read_to_string(&config_file)
            .await
            .unwrap_or_default();

        // Remove SkillHub configuration lines
        let filtered_lines: Vec<&str> = content
            .lines()
            .filter(|line| {
                let trimmed = line.trim();
                !trimmed.starts_with("export ANTHROPIC_BASE_URL=")
                    && !trimmed.starts_with("export ANTHROPIC_API_KEY=")
                    && !trimmed.contains("# SkillHub Claude Code Configuration")
            })
            .collect();

        let new_content = filtered_lines.join("\n") + "\n";

        fs::write(&config_file, new_content)
            .await
            .map_err(|e| format!("Failed to write config file: {}", e))?;
    }

    Ok(())
}

async fn remove_claude_code_config_windows() -> Result<(), String> {
    // Remove user environment variables
    let remove_base_url = Command::new("powershell")
        .args([
            "-Command",
            "[Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', $null, 'User')",
        ])
        .output()
        .map_err(|e| format!("Failed to remove ANTHROPIC_BASE_URL: {}", e))?;

    if !remove_base_url.status.success() {
        return Err(format!(
            "Failed to remove ANTHROPIC_BASE_URL: {}",
            String::from_utf8_lossy(&remove_base_url.stderr)
        ));
    }

    let remove_api_key = Command::new("powershell")
        .args([
            "-Command",
            "[Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'User')",
        ])
        .output()
        .map_err(|e| format!("Failed to remove ANTHROPIC_API_KEY: {}", e))?;

    if !remove_api_key.status.success() {
        return Err(format!(
            "Failed to remove ANTHROPIC_API_KEY: {}",
            String::from_utf8_lossy(&remove_api_key.stderr)
        ));
    }

    Ok(())
}

// ============================================
// API Key Validation
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyValidationResult {
    pub valid: bool,
    pub error_code: Option<String>,  // "invalid_key", "insufficient_balance", etc.
    pub message: Option<String>,
}

pub async fn validate_api_key(api_key: &str) -> Result<ApiKeyValidationResult, String> {
    // Make a simple request to SkillHub API to validate the key
    let client = reqwest::Client::new();
    
    let response = client
        .get(format!("{}/models", SKILLHUB_BASE_URL))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| format!("Failed to validate API key: {}", e))?;

    let status = response.status().as_u16();
    
    match status {
        200 => Ok(ApiKeyValidationResult {
            valid: true,
            error_code: None,
            message: None,
        }),
        401 => Ok(ApiKeyValidationResult {
            valid: false,
            error_code: Some("invalid_key".to_string()),
            message: Some("Invalid API key".to_string()),
        }),
        402 => {
            // Payment required - key is valid but insufficient balance
            Ok(ApiKeyValidationResult {
                valid: true,  // Key is valid, just no balance
                error_code: Some("insufficient_balance".to_string()),
                message: Some("API key is valid but your balance is insufficient. Please top up your wallet.".to_string()),
            })
        },
        _ => {
            // Try to get error message from response body
            let body = response.text().await.unwrap_or_default();
            Ok(ApiKeyValidationResult {
                valid: false,
                error_code: Some(format!("http_{}", status)),
                message: Some(format!("Validation failed: {}", body)),
            })
        }
    }
}

// ============================================
// Manual Install Instructions
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManualInstallInstructions {
    pub step_id: String,
    pub title: String,
    pub instructions: Vec<String>,
    pub docs_url: Option<String>,
}

pub fn get_manual_install_instructions(step_id: &str) -> ManualInstallInstructions {
    let platform = get_platform();

    match step_id {
        "homebrew" => ManualInstallInstructions {
            step_id: "homebrew".to_string(),
            title: "Install Homebrew manually".to_string(),
            instructions: vec![
                "Open Terminal".to_string(),
                "Run the following command:".to_string(),
                r#"/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)""#.to_string(),
                "Follow the on-screen instructions".to_string(),
                "Restart Terminal after installation".to_string(),
            ],
            docs_url: Some("https://brew.sh".to_string()),
        },
        "node" => {
            if platform == "windows" {
                ManualInstallInstructions {
                    step_id: "node".to_string(),
                    title: "Install Node.js manually".to_string(),
                    instructions: vec![
                        "Download Node.js LTS from https://nodejs.org".to_string(),
                        "Run the installer".to_string(),
                        "Follow the installation wizard".to_string(),
                        "Restart your terminal after installation".to_string(),
                    ],
                    docs_url: Some("https://nodejs.org/en/download/".to_string()),
                }
            } else {
                ManualInstallInstructions {
                    step_id: "node".to_string(),
                    title: "Install Node.js manually".to_string(),
                    instructions: vec![
                        "Open Terminal".to_string(),
                        "Run: brew install node".to_string(),
                        "Or download from https://nodejs.org".to_string(),
                    ],
                    docs_url: Some("https://nodejs.org/en/download/".to_string()),
                }
            }
        }
        "claude_code" => ManualInstallInstructions {
            step_id: "claude_code".to_string(),
            title: "Install Claude Code manually".to_string(),
            instructions: vec![
                "Open Terminal (or PowerShell on Windows)".to_string(),
                "Run: npm install -g @anthropic-ai/claude-code".to_string(),
                "Verify installation: claude --version".to_string(),
            ],
            docs_url: Some("https://docs.anthropic.com/claude-code".to_string()),
        },
        _ => ManualInstallInstructions {
            step_id: step_id.to_string(),
            title: "Unknown step".to_string(),
            instructions: vec!["Please check the documentation".to_string()],
            docs_url: None,
        },
    }
}
