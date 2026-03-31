document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('button[role="tab"]');
    const tabPanels = document.querySelectorAll('article[role="tabpanel"]');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.getAttribute('aria-selected') === 'true' || tab.hasAttribute('disabled')) return;

            tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
            tabPanels.forEach(panel => panel.hidden = true);

            tab.setAttribute('aria-selected', 'true');
            const tabPanel = document.getElementById(tab.getAttribute('aria-controls'));
            tabPanel.hidden = false;

        });
    });
});
// this is simply because chrome is stupid