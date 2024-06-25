use std::process::ExitCode;

use anyhow::{Context, Result};
use clap::Parser;
use log::Level;

mod args;
mod configure;
mod deploy;
mod external;
mod logging;

fn run() -> Result<()> {
    use args::Command;

    let args = args::Args::parse();
    let log_level = 3usize + args.verbose as usize - args.quiet as usize;

    logging::setup(log_level).context("Failed to setup logger")?;

    match args.command {
        Command::Configure(args) => configure::configure(&args),
        Command::Deploy(args) => deploy::deploy(&args),
    }
}

pub fn main() -> ExitCode {
    match run() {
        Ok(_) => ExitCode::SUCCESS,
        Err(err) => {
            if log::log_enabled!(Level::Error) {
                log::error!("{:?}", err);
            } else {
                eprintln!("{:?}", err);
            }

            ExitCode::FAILURE
        }
    }
}
