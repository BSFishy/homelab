use anyhow::Result;

use crate::args::ConfigureArgs;

pub fn configure(_args: &ConfigureArgs) -> Result<()> {
    log::info!("Configure hello world");
    log::warn!("This\nIs\nMultiline");

    todo!()
}
