use std::{env, process};
use gstreamer::prelude::*;

fn main() {
    println!("Starting Rust GST");

    let pipeline_str = env::args().collect::<Vec<String>>()[1..].join(" ");

    gstreamer::init().unwrap();

    let mut context = gstreamer::ParseContext::new();
    let pipeline =
        match gstreamer::parse_launch_full(&pipeline_str, Some(&mut context), gstreamer::ParseFlags::empty()) {
            Ok(pipeline) => pipeline,
            Err(err) => {
                if let Some(gstreamer::ParseError::NoSuchElement) = err.kind::<gstreamer::ParseError>() {
                    println!("Missing element(s): {:?}", context.missing_elements());
                } else {
                    println!("Failed to parse pipeline: {err}");
                }

                process::exit(-1)
            }
        };
    let bus = pipeline.bus().unwrap();

    pipeline
        .set_state(gstreamer::State::Playing)
        .expect("Unable to set the pipeline to the `Playing` state");

    for msg in bus.iter_timed(gstreamer::ClockTime::NONE) {
        use gstreamer::MessageView;

        match msg.view() {
            MessageView::Eos(..) => break,
            MessageView::Error(err) => {
                println!(
                    "Error from {:?}: {} ({:?})",
                    err.src().map(|s| s.path_string()),
                    err.error(),
                    err.debug()
                );
                break;
            }
            _ => (),
        }
    }

    pipeline
        .set_state(gstreamer::State::Null)
        .expect("Unable to set the pipeline to the `Null` state");



    println!("Rust GST Stopped");
}
