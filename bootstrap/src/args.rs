use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
pub struct Args {
    #[clap(subcommand)]
    pub command: Command,
}

#[derive(Subcommand, Debug)]
#[command(version)]
pub enum Command {
    /// Bootstrap the current working directory to prepare for deployment
    Bootstrap,
}
