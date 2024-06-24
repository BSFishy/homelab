use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
pub struct Args {
    /// Log in more detail
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub verbose: u8,

    /// Log in less detail
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub quiet: u8,

    #[clap(subcommand)]
    pub command: Command,
}

#[derive(Subcommand, Debug)]
#[command(version)]
pub enum Command {
    /// Configure the project
    Configure(ConfigureArgs),

    /// Deploy services to the cluster
    Deploy(DeployArgs),
}

#[derive(clap::Args, Debug)]
pub struct ConfigureArgs {}

#[derive(clap::Args, Debug)]
pub struct DeployArgs {}
