// Project theme colors - easy to customize!
const projectThemes = {
    'vet-project': '#38a4ac',
    'chalkboard-project': '#3da6ba',
    'story-project': '#e43ad0',
    'mousetrap-project': '#b4844c',
    'celebrity-project': '#148cec',
    'eye-project': '#589ce4',
    'colors-project': '#f661ac',
    'tracking-project': '#a0744c',
    'bigdata-project': '#08b434'
};

// Function to convert hex to rgba with alpha
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Function to lighten a hex color
function lightenColor(hex, percent) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const newR = Math.min(255, Math.floor(r + (255 - r) * percent));
    const newG = Math.min(255, Math.floor(g + (255 - g) * percent));
    const newB = Math.min(255, Math.floor(b + (255 - b) * percent));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Function to apply theme colors to a project
function applyProjectTheme(projectId) {
    const themeColor = projectThemes[projectId];
    if (!themeColor) return;
    
    const projectElement = document.getElementById(projectId);
    if (!projectElement) return;
    
    // Generate lighter colors
    const lightColor = lightenColor(themeColor, 0.4); // 40% lighter for subtitles
    const veryLightColor = hexToRgba(themeColor, 0.7); // Semi-transparent for tech tags
    
    // Apply colors to elements
    const elementsToStyle = {
        '.project-title': { color: themeColor },
        '.project-subtitle': { color: lightColor },
        '.section-title': { 
            color: themeColor,
            borderBottomColor: lightColor
        },
        '.project-description': { color: lightColor },
        '.technology-tag': { 
            color: lightColor,
            backgroundColor: hexToRgba(lightColor, 0.2),
            borderColor: hexToRgba(lightColor, 0.25),
            backdropFilter: 'blur(12px)',
            webkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        },
        'ul li': { color: lightColor },
        'ol li': { color: lightColor },
        'ul li::marker': { color: lightColor },
        'ol li::marker': { color: lightColor }
    };
    
    // Create or update style element for this project
    let styleElement = document.getElementById(`${projectId}-theme-styles`);
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = `${projectId}-theme-styles`;
        document.head.appendChild(styleElement);
    }
    
    // Build CSS
    let css = '';
    for (const [selector, styles] of Object.entries(elementsToStyle)) {
        css += `#${projectId} ${selector} {\n`;
        for (const [property, value] of Object.entries(styles)) {
            // Convert camelCase to kebab-case
            const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
            css += `  ${cssProperty}: ${value} !important;\n`;
        }
        css += '}\n\n';
    }
    
    styleElement.textContent = css;
}

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

    // Initialize all carousels
    const carousels = document.querySelectorAll('.project-image-carousel');
    carousels.forEach(carousel => {
        // Convert image to media container
        const existingImg = carousel.querySelector('.project-image');
        if (existingImg) {
            const mediaContainer = document.createElement('div');
            mediaContainer.className = 'project-media-container';
            existingImg.parentNode.insertBefore(mediaContainer, existingImg);
            existingImg.remove();
            
            const projectId = getProjectId(carousel);
            if (projectId) {
                updateMediaContent(carousel, projectId);
                updateArrowVisibility(carousel, projectId);
            }
        }
    });

    // Setup image popup functionality
    const popup = document.getElementById('image-popup-overlay');
    const popupImg = popup.querySelector('.image-popup-img');
    const closeBtn = popup.querySelector('.image-popup-close');

    // Add click event to initial project images
    document.querySelectorAll('.project-image').forEach(img => {
        setupImagePopup(img);
    });

    // Close popup when clicking the close button
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopup();
    });

    // Close popup when clicking outside the image
    popup.addEventListener('click', () => {
        closePopup();
    });

    // Prevent closing when clicking the image itself
    popupImg.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close popup with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && popup.style.display === 'flex') {
            closePopup();
        }
    });

    // Add a debounce function to prevent excessive event handling
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

    // Modify popup close logic to ensure smooth scrolling
    function closePopup() {
        popup.style.display = 'none';
        document.body.style.overflow = 'auto'; // Ensure scrolling is restored
    }

    // Ensure no scroll event handlers block continuous scrolling
    document.addEventListener('scroll', debounce(() => {
        // Placeholder for any scroll-related logic
        console.log('Scroll event detected');
    }, 50));

    function closePopup() {
        popup.style.display = 'none';
        document.body.style.overflow = 'auto'; // Ensure scrolling is restored
    }

    // Helper function to setup popup for an image
    function setupImagePopup(img) {
        img.style.cursor = 'pointer';
        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent carousel navigation
            popupImg.src = img.src;
            popup.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scrolling during popup
        });
    }

    // ================= Scroll-reveal for project sections =================
    const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    const revealTargets = document.querySelectorAll('.project-section, .about-section, .stats-container, .experience-item, .education-item, .course-item');
    revealTargets.forEach(el => revealObserver.observe(el));

    // ================= Initialize project themes =================
    // Apply themes to all projects on page load
    Object.keys(projectThemes).forEach(projectId => {
        applyProjectTheme(projectId);
    });
});

// Function to open a specific project
function openProject(projectId) {
    // Restore scrolling
    document.body.style.overflow = 'auto';

    // Hide home screen
    const homeScreen = document.getElementById('home-screen');
    if (homeScreen) {
        homeScreen.style.display = 'none';
    }

    // Deactivate any currently-active app screens (projects folder, other projects, etc.)
    document.querySelectorAll('.app-screen.active').forEach(screen => {
        screen.classList.remove('active');
    });

    // Deactivate the projects folder view if it is open
    const projectsApp = document.getElementById('projects-app');
    if (projectsApp) {
        projectsApp.classList.remove('active');
    }

    // Activate the requested project screen
    const projectScreen = document.getElementById(`${projectId}-project`);
    if (projectScreen) {
        projectScreen.classList.add('active');
        // Apply theme colors for this project
        applyProjectTheme(`${projectId}-project`);
    }

    // Ensure status bar is in app mode (dark icons on light background)
    const statusBar = document.querySelector('.status-bar');
    if (statusBar) {
        statusBar.classList.add('in-app');
        statusBar.classList.remove('light-mode');
    }
}

// Project media arrays for each project (now supporting both images and videos)
const projectImages = {
    'vet-project': [
        { type: 'image', src: 'images/vet.png' },
        { type: 'image', src: 'images/VetDatabase2.png' },
        { type: 'image', src: 'images/VetDatabase3.png' },
        { type: 'video', src: 'videos/VetDemo.mp4' }
    ],
    'chalkboard': [
        { type: 'image', src: 'images/ChalkboardLogo.png' },
        { type: 'image', src: 'images/Chalkboard2.png' },
        { type: 'image', src: 'images/Chalkboard3.png' }
    ],
    'story-spinner': [
        { type: 'image', src: 'images/Story.jpeg' },
        { type: 'image', src: 'images/StorySpinner1.png' },
        { type: 'image', src: 'images/StorySpinner2.png' },
        { type: 'video', src: 'videos/StorySpinnerMP4.mp4' }
    ],
    'mousetrap': [
        { type: 'image', src: 'images/Mouse.jpeg' },
        {type: 'image', src: 'images/Mousetrap1.png' },
        { type: 'video', src: 'videos/TrushMousetrap.mp4' },
    ],
    'celebrity': [
        { type: 'image', src: 'images/Celeb.jpeg' },
        { type: 'image', src: 'images/Celebrity2.png' },
        { type: 'image', src: 'images/Celebrity1.jpg.png' },
        { type: 'video', src: 'videos/CelebVid.mp4' }
    ],
    'eye-disease': [
        { type: 'image', src: 'images/Eye.jpeg' },
        { type: 'image', src: 'images/Eye.png' },
        { type: 'image', src: 'images/Eye1.png' },
        { type: 'image', src: 'images/Eye2.png' }
    ],
    'colors': [
        { type: 'image', src: 'images/colors.avif' },
        { type: 'image', src: 'images/Colors1.png' },
        { type: 'image', src: 'images/Colors2.png' },
        { type: 'image', src: 'images/Colors3.png' },
        { type: 'video', src: 'videos/ColorAnimation.mp4' }
    ],
    'package-tracking': [
        { type: 'image', src: 'images/Package.jpeg' },
        { type: 'image', src: 'images/LLM.jpg' },
        { type: 'image', src: 'images/OpenAI.avif' }
    ],
    'bigdata': [
        { type: 'image', src: 'images/GCP.jpg' },
        { type: 'image', src: 'images/GCP2.jpg' },
        { type: 'image', src: 'images/GCP3.jpg' }
    ]
};

// Current image index for each project
const currentImageIndex = {
    'vet-project': 0,
    'chalkboard': 0,
    'story-spinner': 0,
    'mousetrap': 0,
    'celebrity': 0,
    'eye-disease': 0,
    'package-tracking': 0,
    'bigdata': 0,
    'colors': 0
};

function getProjectId(element) {
    const projectHeader = element.closest('.project-header');
    const projectTitle = projectHeader.querySelector('.project-title').textContent.toLowerCase();
    
    const projectMap = {
        'veterinary database system': 'vet-project',
        'chalkboard': 'chalkboard',
        'story spinner': 'story-spinner',
        'mousetrap': 'mousetrap',
        'celebrity look-alike': 'celebrity',
        'color': 'colors',
        'color proportions': 'colors',
        'eye disease detection': 'eye-disease',
        'package tracking system': 'package-tracking',
        'data migration & analysis': 'bigdata'
    };
    
    console.log(`getProjectId called for element:`, element); // Debugging log
    console.log(`Project title extracted: ${projectTitle}`); // Debugging log
    console.log(`Mapped projectId: ${projectMap[projectTitle] || null}`); // Debugging log
    
    return projectMap[projectTitle] || null;
}

// Add debugging logs to check if updateMediaContent is being called
function updateMediaContent(carousel, projectId) {
    console.log(`updateMediaContent called for projectId: ${projectId}`); // Debugging log
    const mediaContainer = carousel.querySelector('.project-media-container');
    const currentMedia = projectImages[projectId][currentImageIndex[projectId]];

    // Clear existing content
    mediaContainer.innerHTML = '';

    if (currentMedia.type === 'video') {
        const video = document.createElement('video');
        video.src = currentMedia.src;
        video.className = 'project-video';
        video.controls = true;
        video.autoplay = false;
        video.style.maxWidth = '100%';
        video.style.borderRadius = '12px';
        video.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        mediaContainer.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = currentMedia.src;
        img.className = 'project-image';
        img.alt = 'Project Image';
        img.style.cursor = 'pointer';

        // Add click event for popup
        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent carousel navigation
            const popup = document.getElementById('image-popup-overlay');
            const popupImg = popup.querySelector('.image-popup-img');
            popupImg.src = img.src;
            popup.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });

        mediaContainer.appendChild(img);
    }
}

function prevImage(button) {
    const projectId = getProjectId(button);
    if (!projectId) return;
    
    const carousel = button.closest('.project-image-carousel');
    const mediaContainer = carousel.querySelector('.project-media-container');
    mediaContainer.style.opacity = '0';
    
    // Loop to the end if at the beginning
    if (currentImageIndex[projectId] <= 0) {
        currentImageIndex[projectId] = projectImages[projectId].length - 1;
    } else {
        currentImageIndex[projectId]--;
    }
    
    setTimeout(() => {
        updateMediaContent(carousel, projectId);
        mediaContainer.style.opacity = '1';
        updateArrowVisibility(carousel, projectId);
    }, 300);
}

function nextImage(button) {
    const projectId = getProjectId(button);
    if (!projectId) return;
    
    const carousel = button.closest('.project-image-carousel');
    const mediaContainer = carousel.querySelector('.project-media-container');
    mediaContainer.style.opacity = '0';
    
    // Loop to the beginning if at the end
    if (currentImageIndex[projectId] >= projectImages[projectId].length - 1) {
        currentImageIndex[projectId] = 0;
    } else {
        currentImageIndex[projectId]++;
    }
    
    setTimeout(() => {
        updateMediaContent(carousel, projectId);
        mediaContainer.style.opacity = '1';
        updateArrowVisibility(carousel, projectId);
    }, 300);
}

function updateArrowVisibility(carousel, projectId) {
    const leftArrow = carousel.querySelector('.carousel-arrow-left');
    const rightArrow = carousel.querySelector('.carousel-arrow-right');
    
    // Always show arrows since we can now loop
    leftArrow.style.visibility = 'visible';
    rightArrow.style.visibility = 'visible';
}

// Refine scroll handling logic to ensure smooth scrolling
let isScrolling;
window.addEventListener('scroll', () => {
    // Perform lightweight operations during scrolling
    console.log('Scrolling in progress');

    // Clear timeout to avoid unnecessary delays
    if (isScrolling) {
        window.clearTimeout(isScrolling);
    }

    // Set a timeout to perform heavier operations after scrolling stops
    isScrolling = setTimeout(() => {
        console.log('Scrolling stopped');
        // Add any post-scroll logic here
    }, 0); // Reduced debounce time for smoother experience
});