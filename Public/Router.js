class Router {
    constructor() {
        this.routes = {
            'roadmap': () => this.showSection('roadmap')
        };
        this.currentRoute = null;
        this.ganttChart = null;
        this.handleHashChange = this.handleHashChange.bind(this);
    }
    init(ganttChart) {
        this.ganttChart = ganttChart;
        window.addEventListener('hashchange', this.handleHashChange);
        this.handleHashChange();
    }
    handleHashChange() {
        const hash = window.location.hash.slice(1); // Remove the '#'
        const route = hash || 'roadmap'; // Default to roadmap
        if (this.routes[route]) {
            this.routes[route]();
            this.currentRoute = route;
        } else {
            this.navigate('roadmap');
        }
    }
    navigate(route) {
        window.location.hash = route;
    }
    showSection(section) {
        const ganttGrid = document.querySelector('.gantt-grid');
        const ganttTitle = document.querySelector('.gantt-title');
        const legend = document.querySelector('.gantt-legend');
        const exportContainer = document.querySelector('.export-container');
        const todayLine = document.querySelector('.today-line');
        switch (section) {
            case 'roadmap':
                if (ganttGrid) {
                    ganttGrid.style.display = '';
                }
                if (ganttTitle) {
                    ganttTitle.style.display = '';
                }
                if (legend) {
                    legend.style.display = '';
                }
                if (todayLine) {
                    todayLine.style.display = '';
                }
                if (exportContainer) {
                    exportContainer.style.display = '';
                }
                break;
            default:
        }
        window.scrollTo(0, 0);
    }
    getCurrentRoute() {
        return this.currentRoute;
    }
    destroy() {
        window.removeEventListener('hashchange', this.handleHashChange);
    }
}
window.Router = Router;
