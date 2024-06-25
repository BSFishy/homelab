use crate::args::ConfigureArgs;

pub fn configure(_args: &ConfigureArgs) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Configure hello world");
    log::warn!("This\nIs\nMultiline");

    todo!()
}
