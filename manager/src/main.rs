use clap::Parser;

mod args;
mod bootstrap;

fn main() {
    use args::Command;

    let args = args::Args::parse();

    match args.command {
        Command::Bootstrap => bootstrap::bootstrap(),
    }
}
