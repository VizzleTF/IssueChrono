# IssueChrono - GitLab Task Visualization

IssueChrono is a web application that provides Gantt chart visualization for GitLab issues and tasks.

## Features

- Interactive Gantt chart view of GitLab issues
- Task filtering by assignees and labels
- Real-time updates of task status
- Drag-and-drop task scheduling
- Automatic task dependency visualization

## Installation

### Using Helm

1. Add the Helm repository:
```bash
helm repo add issuechrono https://vizzletf.github.io/IssueChrono
helm repo update
```

2. Install the chart:
```bash
helm install gantt issuechrono/gantt
```

#### Configuration

You can customize the installation by creating a `values.yaml` file:

```yaml
backend:
  env:
    - name: NODE_ENV
      value: production
    # Add your GitLab configuration here

frontend:
  env:
    - name: VITE_API_URL
      value: http://backend:3001

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        - path: /api
          pathType: Prefix
          service: backend
```

Then install with:
```bash
helm install gantt issuechrono/gantt -f values.yaml
```

### Available Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `backend.replicaCount` | Number of backend replicas | `1` |
| `backend.image.tag` | Backend image tag | `1.0.6` |
| `frontend.replicaCount` | Number of frontend replicas | `1` |
| `frontend.image.tag` | Frontend image tag | `1.0.6` |
| `ingress.enabled` | Enable ingress | `true` |
| `ingress.className` | Ingress class name | `nginx` |

## Development

1. Clone the repository:
```bash
git clone https://github.com/VizzleTF/IssueChrono.git
cd IssueChrono
```

2. Install dependencies:
```bash
cd frontend && npm install
cd ../backend && npm install
```

3. Start development servers:
```bash
# Frontend
cd frontend && npm run dev

# Backend
cd backend && npm run dev
```

## License

MIT License