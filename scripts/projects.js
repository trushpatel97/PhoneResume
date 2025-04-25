document.addEventListener('DOMContentLoaded', () => {
    // Select all project folder apps
    const folderApps = document.querySelectorAll('.folder-app[data-project]');
    
    // Add click event to each project folder
    folderApps.forEach(app => {
        app.addEventListener('click', () => {
            const projectId = app.getAttribute('data-project');
            openProject(projectId);
        });
    });

    // Add back button functionality to all project screens
    const backButtons = document.querySelectorAll('.project-screen .back-button');
    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Hide all project screens
            const projectScreens = document.querySelectorAll('.project-screen');
            projectScreens.forEach(screen => {
                screen.classList.remove('active');
            });
            
            // Show projects app
            const projectsApp = document.getElementById('projects-app');
            projectsApp.classList.add('active');
        });
    });
});

// Function to open a specific project
function openProject(projectId) {
    // Hide projects folder view
    const projectsApp = document.getElementById('projects-app');
    projectsApp.classList.remove('active');
    
    // Show the specific project screen
    const projectScreen = document.getElementById(`${projectId}-project`);
    if (projectScreen) {
        projectScreen.classList.add('active');
    }
} 