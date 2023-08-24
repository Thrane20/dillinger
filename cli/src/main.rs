use clap::{ Command, ArgAction };
use clap::Arg;
use filedb::ManifestManager;
use scrapers::scrapers::{ Scraper, ScrapeEntry };
use serde::{ Deserialize, Serialize };
use std::mem::replace;
use std::rc::Rc;
use std::{ fs, path::PathBuf };
use console::{ Term, style };
use dialoguer::{ theme::ColorfulTheme, Select, Confirm };
use crate::scrapers::{ igdb::IgdbDatabase, scrapers::{ GameDatabase, AuthToken, ScreenshotInfo } };
use crate::global_types::{ DillingerConfig, PathConfig, SecretsConfig };

mod global_types;
mod scrapers;
mod files;
mod filedb;

fn cli() -> Command {
    let config_arg = Arg::new("config")
        .short('c')
        .long("config")
        .value_name("FILE")
        .help("Sets a custom config file");

    let gamedb_arg = Arg::new("gamedb")
        .short('d')
        .long("gamedb")
        .help("Specify the game db to search ['igdb']");

    let screenshots_arg = Arg::new("screenshots")
        .short('s')
        .long("screenshots")
        .required(false)
        .num_args(0..=1)
        .require_equals(true)
        .default_missing_value("false")
        .help("Also download screenshots for the game");

    let name_arg = Arg::new("name").short('n').long("name").help("Name of the game to search for");

    Command::new("dillinger")
        .about("The Dillinger CLI")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .allow_external_subcommands(true)
        .arg(config_arg)
        .subcommand(Command::new("gen_config").about("Generates a new empty YAML config file"))
        .subcommand(
            Command::new("games")
                .about("Operations against the games under dillinger management")
                .subcommand_required(true)
                .arg_required_else_help(true)
                .subcommand(Command::new("ls").about("Lists all games"))
        )
        .subcommand(
            Command::new("scrape")
                .long_flag("screenshots").arg(screenshots_arg)
                .about("Invoke game db scrapers")
                // .arg_required_else_help(true)
                .arg(gamedb_arg)
                .arg(name_arg)
        )
}

fn main() {
    let dillinger_config: DillingerConfig;
    let command = cli();
    let matches = command.get_matches();

    if let Some(c) = matches.get_one::<String>("config") {
        println!("Using config file {c}");
        dillinger_config = load_config(c);
    } else {
        println!("Using default config file");
        dillinger_config = load_config(&"config.yaml".to_string());
    }

    match matches.subcommand() {
        Some(("gen_config", _)) => {
            println!("generating a new config");
            generate_empty_config_file();
        }
        Some(("games", sub_matches)) => {
            let games_command = sub_matches.subcommand().unwrap_or(("", sub_matches));
            match games_command {
                ("ls", _) => {
                    list_games();
                }
                _ => unreachable!(),
            }
        }
        Some(("scrape", sub_matches)) => {
            let game_db = sub_matches
                .get_one::<String>("gamedb")
                .expect("game db must be present")
                .to_string();
            let name = sub_matches
                .get_one::<String>("name")
                .expect("name to search must be present")
                .to_string();

            let screenshots = sub_matches.contains_id("screenshots");

            let _ = do_scrape(name, game_db, screenshots, &dillinger_config);
        }
        _ => (),
    }
}

fn load_config(config_file: &String) -> DillingerConfig {
    // Load the config file
    let dconfig = match fs::read_to_string(config_file) {
        Ok(file) => {
            let config_text = file.clone().into_boxed_str();
            // Unpack the config file and deserialize it into dconfig
            let dconfig: DillingerConfig = match serde_yaml::from_str(&config_text) {
                Ok(file) => {
                    println!("Config file found and loaded");
                    file
                }
                Err(error) => {
                    println!(
                        "Could not open supplied config file: {} - Trouble deserializing YAML",
                        error.to_string()
                    );
                    std::process::exit(1);
                }
            };
            dconfig
        }
        Err(error) => {
            println!(
                "Could not open supplied config file: {} - path provided was {}",
                error.to_string(),
                config_file.to_string()
            );
            std::process::exit(1);
        }
    };

    dconfig
}

fn generate_empty_config() -> DillingerConfig {
    DillingerConfig {
        paths: PathConfig {
            docker_volume_dir: "/mnt/path_to_docker_volumes".to_string(),
            data_dir: "/mnt/path_to_base_data_dir".to_string(),
        },
        secrets: SecretsConfig {
            twitch_client_id: "twitch_client_id".to_string(),
            twitch_client_secret: "twitch_client_secret".to_string(),
        },
    }
}

fn generate_empty_config_file() {
    let dconfig = generate_empty_config();
    let yaml = serde_yaml::to_string(&dconfig);

    // write the file out
    fs::write("./empty_config.yml", yaml.unwrap()).expect("unable to write file");
}

fn list_games() {
    println!("Listing games");
    // Load the games list from the JSON master index

    // And print
}

fn do_scrape(
    name: String,
    game_db: String,
    screenshots: bool,
    dillinger_config: &DillingerConfig
) -> Option<ScrapeEntry> {
    let manifest_manager = ManifestManager::new(dillinger_config);
    let mut scrape_entry;
    println!("Searching for {:?} in games db {}", name, game_db);

    println!("screenshot: {}", screenshots);

    // Instantiate the scraper
    if let Some(mut db) = Scraper::get_scraper(game_db) {
        // Now we have a usable scraper, search for any mathing titles
        let matching_titles = Scraper::get_matching_titles(name, Some(&mut db));

        if let Some(matching_titles) = matching_titles {
            // Show the primary game names found
            let display = format!("Found {} games", matching_titles.len()).to_string();
            println!("{}", style(display).green());
            let names: Vec<&str> = matching_titles
                .iter()
                .map(|game| game.name.as_str())
                .collect();

            // Let the user select the specific game they want
            let selection = Select::with_theme(&ColorfulTheme::default())
                .items(&names)
                .interact_on_opt(&Term::stderr())
                .unwrap();

            let selected_name = match selection {
                Some(index) => names[index],
                None => {
                    println!("No game selected. Scraping cancelled.");
                    ""
                }
            };

            let selected_entry = matching_titles
                .iter()
                .find(|game| game.name == selected_name.to_string())
                .unwrap();
            println!("Selected game: {:?}", selected_entry);

            // Get more game data from the db
            if Confirm::new().with_prompt("Download all game data?").interact().unwrap() {
                println!("Ok. Downloading all game data...");
                scrape_entry = db.get_game_data(selected_entry.id, selected_entry.name.to_string());

                // Create a new scrape file for this game
                let scrape_file = manifest_manager.add_scrape_file(&mut scrape_entry.clone());
                
                // Create (or update) the game's manifest with the latest scrape activity
                scrape_entry.file = scrape_file.to_string_lossy().to_string();
                manifest_manager.add_scrape_activity(&scrape_entry);

                if screenshots {

                    let screenshot_json_array = scrape_entry.json["screenshots"].as_array().unwrap();
                    let screenshot_info = screenshot_json_array.iter().map(|screenshot| ScreenshotInfo {
                        id: screenshot["id"].to_string(),
                        // url: { "https:".to_string() + &screenshot["url"].to_string() },
                        url: format!("https:{}", screenshot["url"].to_string().trim_matches('"').replace("t_thumb", "t_screenshot_huge")),
                        filePath: { 
                            //let manifest_manager = ManifestManager::new(dillinger_config);
                            let mut file_path = scrape_file.with_file_name("");
                            // let mut file_path = PathBuf::from(filedb::ManifestManager::get_scraper_data_path(&manifest_manager));
                            file_path.push(screenshot["id"].to_string());
                            file_path = file_path.with_extension("jpg");
                            file_path
                        },
                        height: screenshot["height"].as_u64().unwrap(),
                    }).collect();    

                    println!("Screenshot info: {:?}", screenshot_info);

                    println!("Downloading screenshots...");
                    let screenshot_count = db.get_screenshots(selected_entry.id, screenshot_info);
                    println!("Downloaded {} screenshots", screenshot_count);
                }
                
                return Some(scrape_entry);
            } else {
                println!("Ok. Scraping cancelled.");
                return None::<ScrapeEntry>;
            }
        }
    }

    None::<ScrapeEntry>
}
