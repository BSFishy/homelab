use users::{get_current_gid, get_current_uid};

fn main() {
    let gid = get_current_gid();
    let uid = get_current_uid();

    println!("Current gid: {}", gid);
    println!("Current uid: {}", uid);
}
