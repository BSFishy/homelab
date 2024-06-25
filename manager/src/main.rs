use anyhow::{Context, Result};
use clap::Parser;

mod args;
mod configure;
mod deploy;
mod external;
mod logging;

pub fn main() -> Result<()> {
    use args::Command;

    let args = args::Args::parse();
    let log_level = 3usize + args.verbose as usize - args.quiet as usize;

    logging::setup(log_level).context("Failed to setup logger")?;

    match args.command {
        Command::Configure(args) => configure::configure(&args),
        Command::Deploy(args) => deploy::deploy(&args),
    }
}
