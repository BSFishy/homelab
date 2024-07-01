import * as k8s from "@pulumi/kubernetes";
import * as fs from "fs";
import * as path from "path";

// Define namespace
const namespace = new k8s.core.v1.Namespace("glance-namespace", {
  metadata: { name: "glance" },
});

// Read glance.yml from the local filesystem
const configFilePath = path.resolve(__dirname, "glance.yml");
const glanceConfig = fs.readFileSync(configFilePath, "utf8");

// Define ConfigMap for glance.yml
const glanceConfigMap = new k8s.core.v1.ConfigMap("glance-config", {
  metadata: {
    name: "glance-config",
    namespace: namespace.metadata.name,
  },
  data: {
    "glance.yml": glanceConfig,
  },
});

// Define the Glance Deployment
const appLabels = { app: "glance" };
const glanceDeployment = new k8s.apps.v1.Deployment("glance-deployment", {
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
              name: glanceConfigMap.metadata.name,
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
const glanceService = new k8s.core.v1.Service("glance-service", {
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
    type: "ClusterIP",
  },
});

// Define the Glance Ingress
const glanceIngress = new k8s.networking.v1.Ingress("glance-ingress", {
  metadata: {
    namespace: namespace.metadata.name,
    annotations: {
      "kubernetes.io/ingress.class": "traefik",
    },
  },
  spec: {
    rules: [
      {
        host: "glance.local", // Replace with your custom domain
        http: {
          paths: [
            {
              path: "/",
              pathType: "Prefix",
              backend: {
                service: {
                  name: glanceService.metadata.name,
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
  serviceName: glanceService.metadata.name,
  namespace: namespace.metadata.name,
  ingressName: glanceIngress.metadata.name,
};
