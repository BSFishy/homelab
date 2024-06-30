use clap::Parser;

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
pub struct Args {
    /// Log in more detail
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub verbose: u8,

    /// Log in less detail
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub quiet: u8,
}
