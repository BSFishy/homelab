use clap::Parser;

mod args;
mod bootstrap;
mod cloudflare;
mod config;
mod configure;
mod nginx;
mod pihole;
mod port_cache;
mod service;
mod template;
mod token_cache;
mod tunnel;

fn main() {
    use args::Command;

    let args = args::Args::parse();

    match args.command {
        Command::Bootstrap(args) => bootstrap::bootstrap(args),
    }
}
