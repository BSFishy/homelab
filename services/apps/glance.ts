import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as fs from "fs";
import * as path from "path";

export class Glance extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;
  public readonly configMap: k8s.core.v1.ConfigMap;
  public readonly deployment: k8s.apps.v1.Deployment;
  public readonly service: k8s.core.v1.Service;
  public readonly ingress: k8s.networking.v1.Ingress;

  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("homelab:application:glance", name, {}, opts);

    // Define namespace
    this.namespace = new k8s.core.v1.Namespace(
      "glance",
      {
        metadata: { name: "glance" },
      },
      { parent: this },
    );

    // Read glance.yml from the local filesystem
    const configFilePath = path.resolve(__dirname, "glance.yml");
    const config = fs.readFileSync(configFilePath, "utf8");

    // Define ConfigMap for glance.yml
    this.configMap = new k8s.core.v1.ConfigMap(
      "glance",
      {
        metadata: {
          name: "glance",
          namespace: this.namespace.metadata.name,
        },
        data: {
          "glance.yml": config,
        },
      },
      { parent: this },
    );

    // Define the Glance Deployment
    const appLabels = { app: "glance" };
    this.deployment = new k8s.apps.v1.Deployment(
      "glance",
      {
        metadata: { namespace: this.namespace.metadata.name },
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
                    name: this.configMap.metadata.name,
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
      },
      { parent: this },
    );

    // Define the Glance Service
    this.service = new k8s.core.v1.Service(
      "glance",
      {
        metadata: {
          namespace: this.namespace.metadata.name,
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
      },
      { parent: this },
    );

    // Define the Glance Ingress
    this.ingress = new k8s.networking.v1.Ingress(
      "glance",
      {
        metadata: {
          namespace: this.namespace.metadata.name,
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
                        name: this.service.metadata.name,
                        port: { number: 8080 },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      { parent: this },
    );

    this.registerOutputs();
  }
}
