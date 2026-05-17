use dillinger_gaming::utils::prompts::{is_auto_yes, set_auto_yes};

#[test]
fn set_and_read_auto_yes() {
    // Should start false by default (tests are isolated via atomic reset).
    set_auto_yes(false);
    assert!(!is_auto_yes());

    set_auto_yes(true);
    assert!(is_auto_yes());

    set_auto_yes(false);
    assert!(!is_auto_yes());
}
