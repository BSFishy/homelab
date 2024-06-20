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
    Bootstrap(BootstrapArgs),
}

#[derive(clap::Args, Debug, Clone)]
pub struct BootstrapArgs {
    /// Always prompt for Cloudflare credentials regardless of whether they already exist in cache
    #[arg(short, long)]
    pub input_credentials: bool,

    /// Always prompt for which account you would like to use
    #[arg(short = 'a', long)]
    pub choose_account: bool,

    /// Always prompt for which website you would like to use
    #[arg(short = 'w', long)]
    pub choose_website: bool,
}
