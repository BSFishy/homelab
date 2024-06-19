use ignore::Walk;
use users::{get_current_gid, get_current_uid};

pub fn bootstrap() {
    let gid = get_current_gid();
    let uid = get_current_uid();

    println!("Current gid: {}", gid);
    println!("Current uid: {}", uid);

    for result in Walk::new(std::env::current_dir().unwrap()) {
        // Each item yielded by the iterator is either a directory entry or an
        // error, so either print the path or the error.
        match result {
            Ok(entry) => {
                let path = entry.path();
                if path.is_dir() {
                    continue;
                }

                println!("{}", path.display());
            }
            Err(err) => println!("ERROR: {}", err),
        }
    }
}
