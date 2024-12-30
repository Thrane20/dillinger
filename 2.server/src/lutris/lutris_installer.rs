use serde::{Deserialize, Serialize};
use serde_yaml::Value;
use std::process::Command;
use std::fs;
use std::path::Path;

// Define Rust structures to represent the YAML sections
#[derive(Debug, Deserialize)]
struct LutrisScript {
    name: String,
    version: String,
    runner: String,
    script: Script,
}

#[derive(Debug, Deserialize)]
struct Script {
    game: Option<GameConfig>,
    files: Option<Vec<FileConfig>>,
    installer: Vec<InstallerStep>,
}

#[derive(Debug, Deserialize)]
struct GameConfig {
    exe: Option<String>,
    args: Option<String>,
    prefix: Option<String>,
    working_dir: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FileConfig {
    id: String,
    url: Option<String>,
    n_a_message: Option<String>, // For "N/A" cases
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum InstallerStep {
    Download { file: String, dst: String },
    Move { src: String, dst: String },
    Execute { command: String, args: Option<String> },
    Extract { file: String, dst: String },
    Chmodx { file: String },
}

// test function to parse the YAML file and execute the steps
fn test() {
    let yaml_path = "example_lutris.yaml"; // Replace with your YAML path
    let yaml_content = fs::read_to_string(yaml_path).expect("Failed to read YAML file");

    let lutris_script: LutrisScript = serde_yaml::from_str(&yaml_content)
        .expect("Failed to parse YAML file");

    println!("Parsed Lutris Script: {:?}", lutris_script);

    // Process the installer steps
    for step in lutris_script.script.installer {
        execute_step(step);
    }
}

// Function to execute individual installer steps
fn execute_step(step: InstallerStep) {
    match step {
        InstallerStep::Download { file, dst } => download_file(&file, &dst),
        InstallerStep::Move { src, dst } => move_file(&src, &dst),
        InstallerStep::Execute { command, args } => execute_command(&command, args),
        InstallerStep::Extract { file, dst } => extract_archive(&file, &dst),
        InstallerStep::Chmodx { file } => make_executable(&file),
    }
}

// Function to download a file using wget
fn download_file(url: &str, destination: &str) {
    println!("Downloading file from {} to {}", url, destination);
    let status = Command::new("wget")
        .arg(url)
        .arg("-O")
        .arg(destination)
        .status()
        .expect("Failed to execute wget");
    if !status.success() {
        panic!("Download failed");
    }
}

// Function to move a file
fn move_file(src: &str, dst: &str) {
    println!("Moving file from {} to {}", src, dst);
    fs::rename(src, dst).expect("Failed to move file");
}

// Function to execute a command
fn execute_command(command: &str, args: Option<String>) {
    println!("Executing command: {} {}", command, args.clone().unwrap_or_default());
    let status = if let Some(arguments) = args {
        Command::new(command)
            .args(arguments.split_whitespace())
            .status()
            .expect("Failed to execute command")
    } else {
        Command::new(command).status().expect("Failed to execute command")
    };
    if !status.success() {
        panic!("Command execution failed");
    }
}

// Function to extract an archive
fn extract_archive(file: &str, destination: &str) {
    println!("Extracting archive {} to {}", file, destination);
    let status = Command::new("tar")
        .arg("-xvf")
        .arg(file)
        .arg("-C")
        .arg(destination)
        .status()
        .expect("Failed to execute tar");
    if !status.success() {
        panic!("Extraction failed");
    }
}

// Function to make a file executable
fn make_executable(file: &str) {
    println!("Making file {} executable", file);
    let status = Command::new("chmod")
        .arg("+x")
        .arg(file)
        .status()
        .expect("Failed to execute chmod");
    if !status.success() {
        panic!("Chmodx failed");
    }
}
