//Opent the details of the selected book
//TODO: This whole section should not be needed once the function getThisBook is implemented
// $(".bookBtn").on("click", function (event) {
// 	event.preventDefault(); // Prevent form submission

// 	// Retrieve data from the button's data-* attributes
// 	const bookKey = $(this).data("key");
// 	// Send data to the server using jQuery's AJAX method
// 	$.ajax({
// 		url: "/select",
// 		type: "POST",
// 		contentType: "application/json",
// 		data: JSON.stringify({ key: bookKey }),
// 		success: function (response) {
// 			console.log("Data sent successfully:", response);
// 			// Handle response (redirect, show message, etc.)
// 			location.assign("/thisBook");
// 		},
// 		error: function (xhr, status, error) {
// 			console.log("Error:", error);
// 		},
// 	});
// });



$(".moreBtn").on("click", function (event) {
	event.preventDefault(); // Prevent form submission
	// Retrieve data from the button's data-* attributes
	const bookId = $(this).data("key");
	// Send data to the server using jQuery's AJAX method
	$.ajax({
		url: "/moreBook",
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify({ key: bookId }),
		success: function (response) {
			console.log("Data sent successfully:", response);
			// Handle response (redirect, show message, etc.)
			location.assign("/thisBook");
		},
		error: function (xhr, status, error) {
			console.log("Error:", error);
		},
	});
});

function filterBooks() {
	const searchInput = document.getElementById("filterBar").value.toLowerCase();
	const cards = document.querySelectorAll(".card-body");
	cards.forEach((card) => {
		const title = card.querySelector(".card-title").textContent.toLowerCase();
		const author = card.querySelector(".card-text").textContent.toLowerCase();
		if (title.includes(searchInput) || author.includes(searchInput)) {
			card.parentElement.style.display = "block";
			// card.classList.remove("hidden");
		} else {
			// card.classList.add("hidden");
			card.parentElement.style.display = "none";
		}
	});
}
