use dillinger_gaming::utils::managed_volumes::{
    build_extra_runner_mount_path, build_managed_docker_volume_name,
};

#[test]
fn normalizes_friendly_names_to_docker_volume_names() {
    assert_eq!(
        build_managed_docker_volume_name("My Games").unwrap(),
        "dillinger_my_games"
    );
    assert_eq!(
        build_managed_docker_volume_name("Retro Archive").unwrap(),
        "dillinger_retro_archive"
    );
    assert_eq!(
        build_managed_docker_volume_name("roms").unwrap(),
        "dillinger_roms"
    );
    assert_eq!(
        build_managed_docker_volume_name("UPPER_CASE").unwrap(),
        "dillinger_upper_case"
    );
}

#[test]
fn rejects_empty_normalized_names() {
    assert!(build_managed_docker_volume_name("***").is_err());
    assert!(build_managed_docker_volume_name("   ").is_err());
}

#[test]
fn maps_docker_volume_name_to_stable_runner_mount_path() {
    assert_eq!(
        build_extra_runner_mount_path("dillinger_roms"),
        "/mnt/dillinger-volumes/dillinger_roms"
    );
    assert_eq!(
        build_extra_runner_mount_path("dillinger_my_collection"),
        "/mnt/dillinger-volumes/dillinger_my_collection"
    );
}
