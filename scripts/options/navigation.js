document.addEventListener('DOMContentLoaded', function () {
	document.querySelectorAll('.menu a').forEach(function (menuLink) {
		menuLink.addEventListener('click', function (ev) {
			ev.preventDefault();
			var selected = 'selected';

			document
				.querySelectorAll('.mainview > *, .menu li')
				.forEach(function (el) {
					el.classList.remove(selected);
				});

			setTimeout(function () {
				document.querySelectorAll('.mainview > *').forEach(function (el) {
					if (!el.classList.contains('selected')) {
						el.style.display = 'none';
					}
				});
			}, 100);

			ev.currentTarget.parentElement.classList.add(selected);

			var currentView = document.querySelector(
				ev.currentTarget.getAttribute('href')
			);
			currentView.style.display = 'block';
			setTimeout(function () {
				currentView.classList.add(selected);
			}, 0);

			setTimeout(function () {
				document.documentElement.scrollTop = 0;
			}, 200);
		});
	});

	// document
	// 	.getElementById('tabAudioModal')
	// 	.addEventListener('click', function (ev) {
	// 		ev.preventDefault();
	// 		var overlay = document.querySelector('.overlay');
	// 		var modal = overlay.cloneNode(true);
	// 		var modalPage = modal.querySelector('.page');

	// 		modal.removeAttribute('style');

	// 		modal
	// 			.querySelectorAll('button, .close-button')
	// 			.forEach(function (button) {
	// 				button.addEventListener('click', function () {
	// 					modal.classList.add('transparent');
	// 					setTimeout(function () {
	// 						modal.remove();
	// 					}, 1000);
	// 				});
	// 			});

	// 		modal.addEventListener('click', function () {
	// 			modalPage.classList.add('pulse');
	// 			modalPage.addEventListener(
	// 				'animationend',
	// 				function handleAnimationEnd() {
	// 					modalPage.classList.remove('pulse');
	// 					modalPage.removeEventListener('animationend', handleAnimationEnd);
	// 				}
	// 			);
	// 		});

	// 		modalPage.addEventListener('click', function (ev) {
	// 			ev.stopPropagation();
	// 		});

	// 		document.body.appendChild(modal);
	// 	});

	document.querySelectorAll('.mainview > *').forEach(function (el) {
		if (!el.classList.contains('selected')) {
			el.style.display = 'none';
		}
	});
});
