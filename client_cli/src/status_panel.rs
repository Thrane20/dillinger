use cursive::{ view::{ Resizable, Nameable }, views::{ Panel, NamedView, TextView, ResizedView } };
use cursive::Cursive;
use dillinger_lib;

pub struct StatusPanel {
    panel: Option<cursive::views::ResizedView<Panel<NamedView<TextView>>>>,
    docker_status: String,
}

impl StatusPanel {

    pub fn new() -> StatusPanel {
        StatusPanel {
            panel: Some(
                Panel::new(TextView::new("?".to_string()).with_name("docker_status")).fixed_height(3),
            ),
            docker_status: "?".to_string()
        }
    }

    pub fn get_panel(&mut self) -> Option<ResizedView<Panel<NamedView<TextView>>>> {
        self.panel.take()
    } 

    // get_docker_status
    pub fn get_docker_status(&self) -> String {
        self.docker_status.to_string()
    }

    pub async fn probe_docker_status(&mut self) {
        let docker_status : bool = dillinger_lib::docker::ping().await;
        let mut ds = self.docker_status.clone();
        if docker_status {
            ds = "UP".to_string();
        } else {
            ds = "DOWN".to_string();
        }

        self.docker_status = ds;

    }    

    pub fn update_docker_status(&mut self, cursive: &mut Cursive, new_status: &str) {
        // Find the named TextView in the Cursive view tree
        if let Some(mut text_view) = cursive.find_name::<TextView>("docker_status") {
            // Update the text of the TextView
            text_view.set_content(new_status.to_string());
        }
    }   
}
