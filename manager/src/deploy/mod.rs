use crate::{args::DeployArgs, external::nomad::Nomad};

pub fn deploy(_args: &DeployArgs) -> Result<(), Box<dyn std::error::Error>> {
    let nomad = Nomad::new();
    nomad.validate_version()?;

    todo!()
}
