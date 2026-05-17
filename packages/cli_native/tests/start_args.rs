use dillinger_gaming::commands::start::{build_start_docker_args, StartOptions};

fn opts() -> StartOptions {
    StartOptions {
        port: None,
        detach: true,
        no_update_check: true,
        gpu: true,
        audio: true,
        display: true,
        input: true,
    }
}

#[test]
fn includes_gpu_audio_display_input_and_detach() {
    let args = build_start_docker_args("dillinger", "core_vol", "img:1", 3010, &opts(), &[]);
    let joined = args.join(" ");
    assert!(joined.contains("/dev/dri:/dev/dri"));
    assert!(joined.contains("/dev/snd:/dev/snd"));
    assert!(joined.contains("/tmp/.X11-unix:/tmp/.X11-unix:rw"));
    assert!(joined.contains("/dev/input:/dev/input"));
    assert!(args.contains(&"-d".to_string()));
}

#[test]
fn omits_passthroughs_when_disabled() {
    let opts = StartOptions {
        gpu: false, audio: false, display: false, input: false, detach: false, ..opts()
    };
    let args = build_start_docker_args("dillinger", "core_vol", "img:1", 3010, &opts, &[]);
    let joined = args.join(" ");
    assert!(!joined.contains("/dev/dri"));
    assert!(!joined.contains("/dev/snd"));
    assert!(!joined.contains("/tmp/.X11-unix"));
    assert!(!joined.contains("/dev/input"));
    assert!(!args.contains(&"-d".to_string()));
}

#[test]
fn extra_volumes_appear_in_args() {
    let extra = vec![("myvol".to_string(), "/mymount".to_string())];
    let args = build_start_docker_args("dillinger", "core_vol", "img:1", 3010, &opts(), &extra);
    let joined = args.join(" ");
    assert!(joined.contains("myvol:/mymount"));
}

#[test]
fn port_binding_uses_provided_port() {
    let args = build_start_docker_args("dillinger", "core_vol", "img:1", 9999, &opts(), &[]);
    let joined = args.join(" ");
    assert!(joined.contains("9999:3010"));
}

#[test]
fn image_is_last_arg() {
    let args = build_start_docker_args("dillinger", "core_vol", "img:1.2.3", 3010, &opts(), &[]);
    assert_eq!(args.last().unwrap(), "img:1.2.3");
}
