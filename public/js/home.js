//Opent the details of the selected book
$(".bookBtn").on("click", function (event) {
	event.preventDefault(); // Prevent form submission

	// Retrieve data from the button's data-* attributes
	const bookKey = $(this).data("key");
	// Send data to the server using jQuery's AJAX method
	$.ajax({
		url: "/select",
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify({ key: bookKey }),
		success: function (response) {
			console.log("Data sent successfully:", response);
			// Handle response (redirect, show message, etc.)
			location.assign("/book");
		},
		error: function (xhr, status, error) {
			console.log("Error:", error);
		},
	});
});

//Add the selected book to my books
$(".addBtn").on("click", function (event) {
	event.preventDefault(); // Prevent form submission

	// Retrieve data from the button's data-* attributes
	const bookKey = $(this).data("key");
	const user_Id = $("#userId").val();
	// Send data to the server using jQuery's AJAX method
	$.ajax({
		url: "/addOne",
		type: "POST",
		contentType: "application/json",
		data: JSON.stringify({ bookId: bookKey, userId: user_Id }),
		success: function (response) {
			console.log("Data sent successfully:", response);
			// Handle response (redirect, show message, etc.)
			location.assign("/myBooks");
		},
		error: function (xhr, status, error) {
			console.log("Error:", error);
		},
	});
});
