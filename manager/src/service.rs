use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Service {
    pub name: String,
    pub enabled: bool,
    pub domain: Option<String>,
    #[serde(with = "ports_format")]
    pub ports: Vec<Port>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Port {
    value: String,
    #[serde(rename = "type")]
    port_type: String,
}

mod ports_format {
    use super::Port;
    use serde::{
        de::{self, Visitor},
        ser::SerializeSeq,
        Deserializer, Serializer,
    };
    use std::fmt;

    pub fn serialize<S>(ports: &Vec<Port>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut seq = serializer.serialize_seq(Some(ports.len()))?;
        for port in ports {
            seq.serialize_element(&port)?;
        }
        seq.end()
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<Port>, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct PortsVisitor;

        impl<'de> Visitor<'de> for PortsVisitor {
            type Value = Vec<Port>;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a sequence of ports")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: de::SeqAccess<'de>,
            {
                let mut ports = Vec::new();

                while let Some(port) = seq.next_element::<Port>()? {
                    ports.push(port);
                }

                Ok(ports)
            }
        }

        deserializer.deserialize_seq(PortsVisitor)
    }
}
