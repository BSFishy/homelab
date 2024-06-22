pub fn generate_conf(ip: &String, domain: &String, port: u16) -> String {
    format!(
        "server {{
    listen 80;
    server_name {};

    location / {{
        proxy_pass http://{}:{};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}",
        domain, ip, port
    )
}
