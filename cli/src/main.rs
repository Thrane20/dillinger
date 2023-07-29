use clap::{Arg, ArgAction, Command, builder::StyledStr};
use serde::{Deserialize, Serialize};
use std::{fs, borrow::BorrowMut};

#[derive(Serialize, Deserialize, PartialEq, Debug)]
struct PathConfig {
    docker_volume_dir: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
struct DillingerConfig {
    paths: PathConfig,
}

fn cli() -> Command {
    Command::new("dillinger")
        .about("The Dillinger CLI")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .allow_external_subcommands(true)
        .subcommand(Command::new("gen_config").about("Generates a new empty YAML config file"))
        .subcommand(
            Command::new("games")
                .about("Operations against the games under dillinger management")
                .arg_required_else_help(true)
                .subcommand(Command::new("ls").about("Lists all games")),
        )
}

fn main() {
    let command = cli();
    let matches = command.get_matches();
    
    match matches.subcommand() {
        Some(("gen_config", _)) => {
            println!("generating a new config");
            generate_empty_config();
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
        _ => (),
    }
}

fn generate_empty_config() {
    let dconfig = DillingerConfig {
        paths: PathConfig {
            docker_volume_dir: "/mnt/path_to_docker_volumes".to_string(),
        },
    };
    let yaml = serde_yaml::to_string(&dconfig);

    // write the file out
    fs::write("./empty_config.yml", yaml.unwrap()).expect("unable to write file");
}

fn list_games() {

    // Load the games list from the JSON master index
    

    // And print

}
