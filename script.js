document.addEventListener("DOMContentLoaded", () => {
    // Define hints and correct answers
    const HINT1 = "First and (almost) last nicknames you used for me";
    const HINT2 = "How I will make sure you never feel (Without first letter 'A')";
    const HINT3 = "What some people in group chats need to do to their sins (Without first letter 'A')";
    const HINT4 = "What I have to pick with the people chatting shit";
    const HINT5 = "'good' in italian";
    const HINT6 = "Cutesy version of saying Baby ";
    const HINT7 = HINT1; // Same as the first hint

    const correctAnswers = {
        CELL1: "LOVE", // Replace with the correct 4-letter word
        CELL2: "LONE", // Replace with the correct 4-letter word
        CELL3: "TONE", // Replace with the correct 4-letter word
        CELL4: "BONE", // Replace with the correct 4-letter word
        CELL5: "BENE", // Replace with the correct 4-letter word
        CELL6: "BEBE", // Replace with the correct 4-letter word
        CELL7: "BEBO"  // Replace with the correct 4-letter word
    };

    const correctOrder = ["CELL1", "CELL2", "CELL3", "CELL4", "CELL5", "CELL6", "CELL7"];

    const cells = document.querySelectorAll(".cell");
    const checkButton = document.getElementById("check");
    const message = document.querySelector(".message");
    const hintBox = document.getElementById("hint-box");
    let draggingCell = null;

    // Directly shuffle hints and correct answers for the desired order: 1, 4, 6, 3, 5, 2, 
    const hints =  [HINT1, HINT2, HINT3, HINT4, HINT5, HINT6, HINT7];
    const shuffledHints = [HINT1, HINT4, HINT6, HINT3, HINT5, HINT2, HINT7];
    const shuffledCellsOrder = [0, 3, 5, 2, 4, 1, 6]; // Reorder cells: 1, 4, 6, 3, 5, 2, 7

    // Reorder cells in the grid container
    const gridContainer = document.querySelector('.grid');
    shuffledCellsOrder.forEach((index, newPosition) => {
        gridContainer.appendChild(cells[index]); // Reattach cells in the new order
    });

    // Assign the shuffled hints to the newly ordered cells
    const reorderedCells = gridContainer.querySelectorAll('.cell'); // Get the cells in the new order
    reorderedCells.forEach((cell, index) => {
        cell.dataset.hint = shuffledHints[index]; // Assign shuffled hints
    });

    // Show hint on cell click
    reorderedCells.forEach((cell) => {
        cell.addEventListener("click", () => {
            hintBox.textContent = cell.dataset.hint;
            hintBox.style.display = "block";
        });
    });

    // Hide hint when clicking outside cells
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".cell")) {
            hintBox.style.display = "none";
        }
    });

    cells.forEach((cell) => {
        const inputs = cell.querySelectorAll("input");
        inputs.forEach((input, index) => {
            input.addEventListener("input", () => {
                input.value = input.value.toUpperCase(); // Capitalize input
                if (input.value && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            });
    
            input.addEventListener("keydown", (event) => {
                if (event.key === "Backspace" && !input.value && index > 0) {
                    inputs[index - 1].focus(); // Move to previous field
                    inputs[index - 1].value = ""; // Clear previous field
                    event.preventDefault(); // Prevent default backspace behavior
                }
            });
        });
    });

    // Drag and drop functionality
    cells.forEach((cell) => {
        if (!cell.classList.contains("locked")) {
            cell.setAttribute("draggable", true);

            cell.addEventListener("dragstart", () => {
                draggingCell = cell;
                setTimeout(() => cell.classList.add("hidden"), 0);
            });

            cell.addEventListener("dragend", () => {
                draggingCell.classList.remove("hidden");
                draggingCell = null;
            });

            cell.addEventListener("dragover", (e) => {
                e.preventDefault();
                const draggedOverCell = e.target.closest(".cell");
                if (draggedOverCell && draggedOverCell !== draggingCell) {
                    const grid = document.querySelector(".grid");
                    const draggingIndex = [...grid.children].indexOf(draggingCell);
                    const targetIndex = [...grid.children].indexOf(draggedOverCell);

                    if (draggingIndex < targetIndex) {
                        grid.insertBefore(draggingCell, draggedOverCell.nextSibling);
                    } else {
                        grid.insertBefore(draggingCell, draggedOverCell);
                    }
                }
            });
        }
    });
    let currentPhase = 1; // Start in Phase 1

    checkButton.addEventListener("click", () => {
        const userAnswers = {};
        const errors = []; // Track cells with errors
    
        // Gather user inputs
        cells.forEach((cell, index) => {
            const cellKey = `CELL${index + 1}`;
            const inputs = [...cell.querySelectorAll("input")];
            userAnswers[cellKey] = inputs.map(input => input.value.trim().toUpperCase()).join("");
        });
    
        console.log("User Answers:", userAnswers);
        console.log("Correct Answers:", correctAnswers);
    
        if (currentPhase === 1) {
            // Phase 1: Validate correct letters for CELL2 to CELL6 (order doesn't matter)
            const phase1Keys = ["CELL2", "CELL3", "CELL4", "CELL5", "CELL6"];
            const phase1Complete = phase1Keys.every(key => userAnswers[key] === correctAnswers[key]);
    
            if (phase1Complete) {
                currentPhase = 2; // Transition to Phase 2
                message.textContent = "Phase 1 complete! Rearrange the cells into the correct order.";
            } else {
                // Highlight errors
                phase1Keys.forEach(key => {
                    if (userAnswers[key] !== correctAnswers[key]) {
                        errors.push(key);
                    }
                });
                message.textContent = "Phase 1: Ensure all cells have the correct letters.";
            }
        } else if (currentPhase === 2) {
            // Phase 2: Validate correct order for CELL2 to CELL6
            const currentOrder = [...document.querySelectorAll(".cell")]
            .slice(1, 6) // Only CELL2 to CELL6
            .map(cell => cell.dataset.hint);
            temp = hints.slice(1,-1)
            console.log("Current Order:", currentOrder);
            console.log("Correct Order:", temp);
            
            const isCorrectOrder = JSON.stringify(currentOrder) === JSON.stringify(temp);
    
            if (isCorrectOrder) {
                currentPhase = 3; // Transition to Phase 3
                // Unlock CELL1 and CELL7
                console.log("Cells 1 and 7 are unlocked")

                const cell1 = cells[0];
                const cell7 = cells[6];
        
                cell1.classList.remove("locked");
                cell7.classList.remove("locked");

                const lockIcon1 = cell1.querySelector(".lock-icon");
                const lockIcon7 = cell7.querySelector(".lock-icon");
        
                if (lockIcon1) lockIcon1.remove(); // Remove lock icon from CELL1
                if (lockIcon7) lockIcon7.remove(); // Remove lock icon from CELL7

                const hintBoxStyle = {
                    backgroundColor: "#fffae5",
                    border: "1px solid #ffcc00",
                };
        
                // Apply the styles to the unlocked cells
                Object.assign(cell1.style, hintBoxStyle);
                Object.assign(cell7.style, hintBoxStyle);
        
                // Create input fields dynamically for CELL1 and CELL7 if they don't exist
                if (!cell1.querySelector("input")) {
                    for (let i = 0; i < 4; i++) {
                        const input = document.createElement("input");
                        input.maxLength = 1; // Only one character
                        cell1.appendChild(input);
                    }
                }
        
                if (!cell7.querySelector("input")) {
                    for (let i = 0; i < 4; i++) {
                        const input = document.createElement("input");
                        input.maxLength = 1; // Only one character
                        cell7.appendChild(input);
                    }
                }
        
                // Disable dragging for CELL1 and CELL7
                cell1.setAttribute("draggable", "false");
                cell7.setAttribute("draggable", "false");
                const cellsToApplyFocus = [cell1, cell7];
                cellsToApplyFocus.forEach((cell) => {
                    const inputs = cell.querySelectorAll("input");
                    inputs.forEach((input, index) => {
                        input.addEventListener("input", () => {
                            input.value = input.value.toUpperCase(); // Capitalize input
                            if (input.value && index < inputs.length - 1) {
                                inputs[index + 1].focus();
                            }
                        });
                    });
                });
                message.textContent = "Phase 2 complete! Enter the correct letters for cell 1 and cell 7.";
            } else {
                message.textContent = "Phase 2: Rearrange the cells into the correct order.";
                errors.push("ORDER"); // Track a generic order error
            }
        } else if (currentPhase === 3) {
            // Phase 3: Validate CELL1 and CELL7
            const phase3Keys = ["CELL1", "CELL7"];
            const phase3Complete = phase3Keys.every(key => userAnswers[key] === correctAnswers[key]);
    
            if (phase3Complete) {
                message.textContent = "YOU WON BOOCH!";
            } else {
                // Highlight errors
                phase3Keys.forEach(key => {
                    if (userAnswers[key] !== correctAnswers[key]) {
                        errors.push(key);
                    }
                });
                message.textContent = "Phase 3: Ensure cell 1 and cell 7 have the correct letters.";
            }
        }
    
        // Highlight errors
        cells.forEach((cell, index) => {
            const cellKey = `CELL${index + 1}`;
            if (errors.includes(cellKey) || (errors.includes("ORDER") && index >= 1 && index <= 5)) {
                cell.classList.add("error");
                setTimeout(() => cell.classList.remove("error"), 1000);
            }
        });
    });  
});
