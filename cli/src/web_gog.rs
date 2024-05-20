
// use std::path::PathBuf;
// use std::fs;


// Write a file to disk
// pub fn write_file(path: &PathBuf, contents: String, create_dir: bool) {

//     if create_dir {
//         // Create the directory if it doesn't exist
//         fs::create_dir_all(&path.parent().unwrap()).expect("unable to create directory");
//     }

//     // Write the file
//     fs::write(path, contents).expect("unable to write file");
// }

// pub fn read_file(path: &PathBuf) -> String {

//     fs::read_to_string(path).unwrap_or_default()
// //    match fs::read_to_string(path) {
// //         Ok(file) => { 
// //             file
// //         },
// //         Err(_) => {
// //             "".to_string()
// //         }
// //     }
    
// }

