use tokio::runtime::Runtime;
use cursive::{ view::{ Resizable }, views::{ Panel, ResizedView, TextView, LinearLayout } };

use crate::status_panel::StatusPanel;

pub mod theme_default;
pub mod status_panel;

// create a static variable to hold a date


fn main() {
    
    let rt = Runtime::new().unwrap();

    const TITLE: &str = "Dillinger-tui";
    let mut siv = cursive::default();
    siv.set_theme(theme_default::get_theme());

    let platform_panel = Panel::new(TextView::new("platform"))
        .title("Platform")
        .full_height()
        .fixed_width(20);

    let working_panel = Panel::new(TextView::new("working")).full_height().full_width();
    let primary_layout = LinearLayout::horizontal().child(platform_panel).child(working_panel);
    let primary_panel = Panel::new(primary_layout).title("").full_height();

    let mut status_panel : StatusPanel = StatusPanel::new();
    let sp = StatusPanel::get_panel(&mut status_panel);

    let main_screen_layout = LinearLayout::vertical()
        .child(primary_panel)
        .child(sp.unwrap())
        .full_height();

    let root_layout = LinearLayout::vertical().child(
        // Create a bordered view to fill the screen
        ResizedView::with_full_screen(
            Panel::new(
                // Create a text view as the content
                main_screen_layout
            ).title(TITLE)
        )
    );

    // Set the root layout as the main view
    siv.add_layer(root_layout);

    rt.block_on(async {
        StatusPanel::probe_docker_status(&mut status_panel).await;
        let s = StatusPanel::get_docker_status(&status_panel);

        StatusPanel::update_docker_status(&mut status_panel, &mut siv, &s);
    });

    siv.run();

    

}


