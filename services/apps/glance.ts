import * as k8s from "@pulumi/kubernetes";
import * as fs from "fs";
import * as path from "path";

// Define namespace
const namespace = new k8s.core.v1.Namespace("glance", {
  metadata: { name: "glance" },
});

// Read glance.yml from the local filesystem
const configFilePath = path.resolve(__dirname, "glance.yml");
const config = fs.readFileSync(configFilePath, "utf8");

// Define ConfigMap for glance.yml
const configMap = new k8s.core.v1.ConfigMap("glance", {
  metadata: {
    name: "glance",
    namespace: namespace.metadata.name,
  },
  data: {
    "glance.yml": config,
  },
});

// Define the Glance Deployment
const appLabels = { app: "glance" };
const deployment = new k8s.apps.v1.Deployment("glance", {
  metadata: { namespace: namespace.metadata.name },
  spec: {
    selector: { matchLabels: appLabels },
    replicas: 1,
    template: {
      metadata: { labels: appLabels },
      spec: {
        containers: [
          {
            name: "glance",
            image: "glanceapp/glance",
            volumeMounts: [
              {
                name: "glance-config-volume",
                mountPath: "/app/glance.yml",
                subPath: "glance.yml",
              },
              {
                name: "timezone",
                mountPath: "/etc/timezone",
                readOnly: true,
              },
              {
                name: "localtime",
                mountPath: "/etc/localtime",
                readOnly: true,
              },
            ],
            ports: [{ containerPort: 8080 }],
          },
        ],
        volumes: [
          {
            name: "glance-config-volume",
            configMap: {
              name: configMap.metadata.name,
            },
          },
          {
            name: "timezone",
            hostPath: {
              path: "/etc/timezone",
            },
          },
          {
            name: "localtime",
            hostPath: {
              path: "/etc/localtime",
            },
          },
        ],
      },
    },
  },
});

// Define the Glance Service
const service = new k8s.core.v1.Service("glance", {
  metadata: {
    namespace: namespace.metadata.name,
    labels: appLabels,
  },
  spec: {
    selector: appLabels,
    ports: [
      {
        port: 8080,
        targetPort: 8080,
      },
    ],
    type: "LoadBalancer",
  },
});

// Define the Glance Ingress
const ingress = new k8s.networking.v1.Ingress("glance", {
  metadata: {
    namespace: namespace.metadata.name,
    annotations: {
      "kubernetes.io/ingress.class": "traefik",
    },
  },
  spec: {
    rules: [
      {
        host: "glance.home", // Replace with your custom domain
        http: {
          paths: [
            {
              path: "/",
              pathType: "Prefix",
              backend: {
                service: {
                  name: service.metadata.name,
                  port: { number: 8080 },
                },
              },
            },
          ],
        },
      },
    ],
  },
});

// Export the service name and namespace
export const output = {
  serviceName: service.metadata.name,
  namespace: namespace.metadata.name,
  ingressName: ingress.metadata.name,
  ips: service.status.loadBalancer.ingress.apply((ingress) =>
    ingress.map((ingress) => ingress.ip),
  ),
};
