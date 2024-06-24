use clap::Parser;

mod args;
mod configure;
mod deploy;
mod external;
mod logging;

pub fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = args::Args::parse();
    let log_level = 3usize + args.verbose as usize - args.quiet as usize;

    logging::setup(log_level)?;

    log::trace!("Trace");
    log::debug!("Debug");
    log::info!("Hello world!");
    log::warn!("warm");
    log::error!("error");

    Ok(())
}
