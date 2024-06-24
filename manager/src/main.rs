mod args;
mod configure;
mod deploy;
mod external;
mod logging;

pub fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Hello world");

    Ok(())
}
