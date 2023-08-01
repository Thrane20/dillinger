use clap::{arg, Command};
use global_types::Game;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use console::{Term, style};
use dialoguer::{theme::ColorfulTheme, Select, Confirm};
use crate::scrapers::{igdb::IgdbDatabase, scrapers::{GameDatabase, AuthToken}};
use crate::global_types::{ DillingerConfig, PathConfig, SecretsConfig };

mod global_types;   
mod scrapers;
mod files;
mod filedb;



fn cli() -> Command {

    Command::new("dillinger")
        .about("The Dillinger CLI")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .allow_external_subcommands(true)
        .arg(arg!(-c --config <config> "Specify a specific config file").required(false))
        .subcommand(Command::new("gen_config").about("Generates a new empty YAML config file"))
        .subcommand(
            Command::new("games")
                .about("Operations against the games under dillinger management")
                .subcommand_required(true)
                .arg_required_else_help(true)
                .subcommand(Command::new("ls").about("Lists all games")),
        )
        .subcommand(
            Command::new("scrape")
                .about("Invoke game db scrapers")
                .arg_required_else_help(true)
                .arg(arg!(-d <game_db> "Specify the game db to search ['igdb']").required(true))
                .arg(arg!(-n <name> "Name of the game to search for").required(true))
        )
}

fn main() {

    let dillinger_config : DillingerConfig;
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
                ("ls", _)=> {
                    list_games();
                },
                _ => unreachable!()
            }
        }
        Some(("scrape", sub_matches)) => {
            
            let game_db = sub_matches.get_one::<String>("game_db").expect("game db must be present").to_string();
            let name = sub_matches.get_one::<String>("name").expect("name to search must be present").to_string();
            scrape_begin(name, game_db, dillinger_config);
            // update_game_manifest()
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
                },
                Err(error) => {
                    println!("Could not open supplied config file: {}", error.to_string());
                    std::process::exit(1);
                }
            };
            dconfig
        },
        Err(error) => {
            println!("Could not open supplied config file: {}", error.to_string());
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

fn scrape_begin(name: String, game_db: String, dillinger_config: DillingerConfig) -> Option<Game> {

    let mut found_game = Game::new();
    println!("Searching for {:?} in games db {}", name, game_db);

    // Instantiate the game db we need to use
    let mut gamedb: Option<Box<dyn GameDatabase>> = None;
    match game_db.as_str() {
        "igdb" => {
            gamedb = Some(Box::new(IgdbDatabase { auth_token: AuthToken::new() }));
        }
        _ => { println!("Unknown game db {:?}. Scrape cancelled.", game_db); None::<Game>;}
    }

    // Search for the game
    if let Some(mut db) = gamedb {
        let games = db.search_game(name.as_str());

        // Show the primary game names found
        let display = format!("Found {} games", games.len()).to_string();
        println!("{}", style(display).green());
        let names: Vec<&str> = games.iter().map(|game| game.name.as_str()).collect();

        // Let the user select the specific game they want
        let selection = Select::with_theme(&ColorfulTheme::default())
        .items(&names)
        .interact_on_opt(&Term::stderr()).unwrap();

        let selected_name = match selection {
            Some(index) => names[index],
            None => { 
                println!("No game selected. Scraping cancelled.");
                ""
            }
        };

        let selected_game = games.iter().find(|game| game.name == selected_name.to_string()).unwrap();
        println!("Selected game: {:?}", selected_game.name);

        // Get more game data from the db
        if Confirm::new().with_prompt("Download all game data?").interact().unwrap() {
            println!("Ok. Downloading all game data...");
            found_game = db.get_game_data(selected_game.id, selected_game.name.to_string());

            // Store the game data to the local db
            let json_serialized = serde_json::to_string_pretty(&found_game).unwrap();
            let mut path = PathBuf::from(dillinger_config.paths.data_dir);
            path.push("scraper_data");
            path.push(format!("{}.json", found_game.get_identified_slug()));

            println!("Writing game data to {:?}", path);

            // write the file out
            files::write_file(path, json_serialized, true);
        }

        Some(found_game)
    } else {
        None::<Game>
    }
    
}
