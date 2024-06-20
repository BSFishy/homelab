use std::{
    collections::HashMap,
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener},
};

type Port = u16;

const PORT_RANGE_START: Port = 49152;
const PORT_RANGE_END: Port = 65535;

fn is_port_in_use(port: Port) -> bool {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port);
    TcpListener::bind(address).is_err()
}

#[derive(Debug)]
pub struct PortCache {
    next_port: Port,
    mapping: HashMap<String, Port>,
}

impl Default for PortCache {
    fn default() -> Self {
        Self {
            next_port: PORT_RANGE_START,
            mapping: Default::default(),
        }
    }
}

impl PortCache {
    pub fn get<S: AsRef<str>>(&mut self, name: S) -> Port {
        let name = name.as_ref().to_string();
        if let Some(port) = self.mapping.get(&name) {
            return *port;
        }

        let mut current_port = self.next_port;
        while is_port_in_use(current_port) && current_port <= PORT_RANGE_END {
            current_port += 1;
        }

        if current_port > PORT_RANGE_END {
            panic!("Could not find a port in range");
        }

        self.mapping.insert(name, current_port);
        self.next_port = current_port + 1;

        current_port
    }

    pub fn mapping(&self) -> &HashMap<String, Port> {
        &self.mapping
    }
}
