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

    function closePopup() {
        popup.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
    }

    // Helper function to setup popup for an image
    function setupImagePopup(img) {
        img.style.cursor = 'pointer';
        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent carousel navigation
            popupImg.src = img.src;
            popup.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });
    }
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

// Project media arrays for each project (now supporting both images and videos)
const projectImages = {
    'vet-project': [
        { type: 'image', src: 'images/VetDatabase.jpg' },
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
        { type: 'image', src: 'images/StorySpinner.jpg' },
        { type: 'image', src: 'images/StorySpinner2.jpg' },
        { type: 'image', src: 'images/StorySpinner3.jpg' }
    ],
    'mousetrap': [
        { type: 'image', src: 'images/Mousetrap.JPEG' },
        { type: 'image', src: 'images/Mousetrap2.JPEG' },
        { type: 'image', src: 'images/Mousetrap3.JPEG' }
    ],
    'celebrity': [
        { type: 'image', src: 'images/Celebrity.jpg' },
        { type: 'image', src: 'images/Celebrity2.jpg' },
        { type: 'image', src: 'images/Celebrity3.jpg' }
    ],
    'eye-disease': [
        { type: 'image', src: 'images/Eyes.jpg' },
        { type: 'image', src: 'images/Eyes2.jpg' },
        { type: 'image', src: 'images/Eyes3.jpg' }
    ],
    'package-tracking': [
        { type: 'image', src: 'images/UPS.jpg' },
        { type: 'image', src: 'images/UPS2.jpg' },
        { type: 'image', src: 'images/UPS3.jpg' }
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
    'bigdata': 0
};

function getProjectId(element) {
    const projectHeader = element.closest('.project-header');
    const projectTitle = projectHeader.querySelector('.project-title').textContent.toLowerCase();
    
    const projectMap = {
        'veterinary database system': 'vet-project',
        'chalkboard': 'chalkboard',
        'story spinner': 'story-spinner',
        'mousetrap': 'mousetrap',
        'celebrity look-alike detector': 'celebrity',
        'eye disease detection': 'eye-disease',
        'package tracking system': 'package-tracking',
        'bigdata migration & analysis': 'bigdata'
    };
    
    return projectMap[projectTitle] || null;
}

function updateMediaContent(carousel, projectId) {
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