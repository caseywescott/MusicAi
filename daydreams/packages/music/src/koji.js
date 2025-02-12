/**
 * Musical modes defined by interval patterns (in semitones)
 * @type {Object.<string, number[]>}
 */
const modes = {};

// Major scale: Whole, Whole, Half, Whole, Whole, Whole, Half
modes.major = [2, 2, 1, 2, 2, 2, 1];
// Mixolydian: Major scale with flat 7
modes.mixolydian = [2, 2, 1, 2, 2, 1, 2];
// Dorian: Minor scale with natural 6
modes.dorian = [2, 1, 2, 2, 2, 1, 2];
// Natural minor scale
modes.aeolian = [2, 1, 2, 2, 2, 2, 2];
// Phrygian: Minor scale with flat 2
modes.phrygian = [1, 2, 2, 2, 1, 2, 2];
// Lydian: Major scale with sharp 4
modes.lydian = [2, 2, 2, 1, 2, 2, 1];
// Locrian: Minor scale with flat 2 and flat 5
modes.locrian = [1, 2, 2, 1, 2, 2, 2];
// Barry Harris bebop scale
modes.barryharris = [2, 2, 1, 2, 1, 1, 2, 1];
// Pentatonic scale (no avoid notes)
modes.pentatonic = [2, 2, 3, 2, 3];
// Emahoy scale (no avoid notes)
modes.emahoy = [2, 1, 1, 3, 2, 3];
// Hexatonic scale (no avoid notes)
modes.hexatonic = [2, 2, 3, 2, 2, 1];
// Minor pentatonic scale
modes.minor_pentatonic = [3, 2, 2, 3, 2];
// Minor hexatonic scale
modes.minor_hexatonic = [2, 1, 2, 2, 3, 2];
// Natural minor/Aeolian
modes.minor = [2, 1, 2, 2, 1, 2, 2];


/** Number of semitones in an octave */
const octavebase = 12;

/**
 * Maps note names to their numeric values (0-11)
 * @param {string} noteName - Note name (e.g., 'C', 'C#', 'Db', 'G')
 * @returns {number} Note value (0-11)
 */
function noteNameToNumber(noteName) {
    const noteMap = {
        'c': 0,  'c#': 1,  'db': 1,
        'd': 2,  'd#': 3,  'eb': 3,
        'e': 4,
        'f': 5,  'f#': 6,  'gb': 6,
        'g': 7,  'g#': 8,  'ab': 8,
        'a': 9,  'a#': 10, 'bb': 10,
        'b': 11
    };
    
    return noteMap[noteName.toLowerCase()] ?? -1;
}

/**
 * PitchClass represents a musical pitch with note and octave
 * @param {number} note - MIDI note number
 * @param {number} octave - Octave number (optional)
 */
function PitchClass(note, octave) {
    this.note = note % octavebase;
    this.octave = octave || Math.floor(note / octavebase);

    /** Convert to MIDI key number */
    this.pcToKeynum = function() {
        return this.note + octavebase * this.octave;
    }

    /** Get scale degree in a mode */
    this.scaleDegree = function(tonic, mode) {
        var key_arr = get_notes_of_key_fix(tonic, mode);
        return key_arr.indexOf(this.note);
    }

    /** Transpose by modal steps */
    this.modalTransposition = function(steps, tonic, mode) {
        var key_arr = get_notes_of_key(tonic, mode);
        var scaledegree = this.scaleDegree(tonic, mode);
        var keyn = this.note + octavebase * this.octave;
        var total_steps = num_steps_from_scale_degree_fix(scaledegree, steps, tonic, mode);
        return new PitchClass(keyn + total_steps);
    }

    /** Convert MIDI key number to note (0-11) */
    this.keynumToNote = function(keynum) {
        return keynum % octavebase;
    }

    /** Quantize to nearest note in mode */
    this.quantizeToModeKeynum = function(tonic, mode) {
        var key_arr = get_notes_of_key(tonic, mode);
        var index = findNearestElement(key_arr, this.note);
        return index + 12 * this.octave;
    }

    /** Quantize to nearest PitchClass in mode */
    this.quantizeToModePC = function(tonic, mode) {
        var key_arr = get_notes_of_key(tonic, mode);
        var index = findNearestElement(key_arr, this.note);
        return new PitchClass(index + 12 * this.octave);
    }

    /** Calculate modal steps between pitches */
    this.stepsToPC = function(pc, tonic, mode) {
        var qnote = this.quantizeToModePC(tonic, mode);
        var qpc = pc.quantizeToModePC(tonic, mode);
        var qnotedegree = qnote.get_scale_degree(tonic, mode);
        var qpcdegree = qpc.get_scale_degree(tonic, mode);
        
        if (qnotedegree > qpcdegree) {
            var octave_diff = qpc.octave - qnote.octave;
            return (qpcdegree - qnotedegree) * (mode.length * octave_diff);
        } else {
            var octave_diff = qnote.octave - qpc.octave;
            return (qnotedegree - qpcdegree) * (mode.length * octave_diff);
        }
    }

    /** Get scale degree after quantizing to mode */
    this.get_scale_degree = function(tonic, mode) {
        var quant_pc = this.quantizeToModePC(tonic, mode);
        var key_arr = get_notes_of_key(tonic, mode);
        return key_arr.indexOf(quant_pc.note);
    }
}

// Utility Functions

/**
 * Converts a MIDI key number to a note value (0-11)
 * @param {number} keynum - MIDI key number
 * @returns {number} Note value in the octave
 */
function keynumToNote(keynum) {
    return keynum % octavebase;
}

/**
 * Converts a MIDI key number to a PitchClass object
 * @param {number} keynum - MIDI key number
 * @returns {PitchClass} New PitchClass object
 */
function keynumToPitchClass(keynum) {
    var pc = new PitchClass(keynum % octavebase, Math.floor(keynum / octavebase));
    return pc;
}

/**
 * Generates an array of notes above a base pitch following a mode pattern
 * @param {number} pitchbase - Starting pitch
 * @param {number[]} mode - Array of intervals defining the mode
 * @returns {number[]} Array of note values
 */
function mode_notes_above_note_base(pitchbase, mode) {
    var step_sum = 0;
    var notes = new Array(mode.length);

    for (var i = 0; i < notes.length; i++) {
        step_sum = step_sum + mode[i];
        notes[i] = pitchbase + step_sum;
    }
    return notes;
}

/**
 * Gets all notes in a key, fixing the array length issue
 * @param {PitchClass} pc - Starting pitch class
 * @param {number[]} mode - Mode intervals
 * @returns {number[]} Array of notes in the key
 */
function get_notes_of_key_fix(pc, mode) {
    var step_sum = 0;
    var notes = new Array(mode.length);
    notes[0] = pc.note;

    for (var i = 0; i < mode.length - 1; i++) {
        step_sum = step_sum + mode[i];
        notes[i + 1] = (pc.note + step_sum) % 12;
    }
    return notes;
}

/**
 * Gets scale degree of a pitch class in a mode
 * @param {PitchClass} pc - Pitch class to analyze
 * @param {PitchClass} tonic - Root note of the mode
 * @param {number[]} mode - Mode intervals
 * @returns {number} Scale degree (0-based index)
 */
function get_scale_degree(pc, tonic, mode) {
    var key_arr = get_notes_of_key_fix(tonic, mode);
    return key_arr.indexOf(pc.note);
}

/**
 * Converts MIDI key number to scale degree
 * @param {number} keynum - MIDI key number
 * @param {PitchClass} tonic - Root note of the mode
 * @param {number[]} mode - Mode intervals
 * @returns {number} Scale degree (0-based index)
 */
function keynum_to_scale_degree(keynum, tonic, mode) {
    var key_arr = get_notes_of_key(tonic, mode);
    var note = keynumToNote(keynum);
    return key_arr.indexOf(note);
}

/**
 * Calculates semitone steps from a scale degree
 * @param {number} scale_degree - Starting scale degree
 * @param {number} num_steps - Number of steps to move
 * @param {PitchClass} tonic - Root note of the mode
 * @param {number[]} mode - Mode intervals
 * @returns {number} Total semitones to move
 */
function num_steps_from_scale_degree_fix(scale_degree, num_steps, tonic, mode) {
    var abs_steps = Math.abs(num_steps);
    var sum = 0;
    var reverse_mode = reverseArray(mode);
    var inverted_scale_degree = mode.length - 1 - (Math.abs(scale_degree) % mode.length);

    for (var i = 0; i < abs_steps; i++) {
        if (num_steps < 0) {
            var currentstep = (inverted_scale_degree + 1 + i) % mode.length;
            sum = sum - reverse_mode[currentstep];
        } else {
            var currentstep = (scale_degree + i) % mode.length;
            sum = sum + mode[currentstep];
        }
    }
    return sum;
}

/**
 * Reverses array order
 * @param {Array} arr - Input array
 * @returns {Array} New reversed array
 */
function reverseArray(arr) {
    return arr.slice().reverse();
}

function num_steps_from_scale_degree(scale_degree, num_steps, tonic, mode) {
    var abs_steps = Math.abs(num_steps);
    var sum = 0;
    var currentstep;
    var reverse_mode = reverseArray(mode); // Use a separate function to reverse the array
    var inverted_scale_degree =
        (mode.length - 1 - Math.abs(scale_degree)) % mode.length;

    for (var i = 0; i < abs_steps; i++) {
        if (num_steps < 0) {
            var currentstep = (inverted_scale_degree + Math.abs(i)) % mode.length;
            sum = sum - reverse_mode[currentstep];
        } else {
            var currentstep = (scale_degree + i) % mode.length;
            sum = sum + mode[currentstep];
        }
    }

    return sum;
}

/**
 * Quantizes a MIDI key number to nearest note in mode
 * @param {number} keynum - MIDI key number
 * @param {PitchClass} tonic - Root note
 * @param {number[]} mode - Mode intervals
 * @returns {number} Quantized MIDI key number
 */
function quantizeKeynumToMode(keynum, tonic, mode) {
    var octave = 12 * Math.trunc(keynum / 12);
    var key_arr = get_notes_of_key(tonic, mode);
    var index = findNearestElement(key_arr, keynum % 12);
    return index + octave;
}

/**
 * Finds nearest value in array to target number
 * @param {number[]} array - Array to search
 * @param {number} number - Target value
 * @returns {number} Closest value from array
 */
function findNearestElement(array, number) {
    var closest = array[0];
    for (var i = 1; i < array.length; i++) {
        if (Math.abs(array[i] - number) < Math.abs(closest - number)) {
            closest = array[i];
        }
    }
    return closest;
}

function findNearestElementIndex(array, number) {
    var closestIndex = -1;
    var closestDifference = Number.MAX_VALUE;

    for (var i = 0; i < array.length; i++) {
        var difference = Math.abs(array[i] - number);
        if (difference < closestDifference) {
            closestDifference = difference;
            closestIndex = i;
        }
    }

    return closestIndex;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomIntArray(n, min, max) {
    var outputArray = [];
    var range = max - min + 1; // Calculate the range once

    for (var i = 0; i < n; i++) { // Use n instead of n+1
        outputArray.push(Math.floor(Math.random() * range) + min);
    }

    return outputArray;
}

/**
 * Generates random voicing intervals for chord construction
 * @returns {number[]} Array of interval steps
 */
function generateVoicingArray() {
    var voicings = [
        [2,4],         // Basic triad
        [-1,2,4],      // First inversion
        [2,4,6],       // Extended triad
        [2,4,5],       // Close voicing
        [1,4],         // Open voicing
        [2,4,6,8],     // Seventh chord
        [-1,-3,2],     // Clustered voicing
        [2,-3,-6],     // Spread voicing
        [1,2,4],       // Tight cluster
        [-3,-6],       // Open fifths
        [2,4,6,8],     // Extended seventh
        [4,5]          // Quartal voicing
    ];
    return voicings[getRandomInt(0, voicings.length-1)];
}

/**
 * Applies modal transposition to generate chord voicings
 * @param {PitchClass} pc - Root pitch class
 * @param {PitchClass} tonic - Mode tonic
 * @param {number[]} mode - Mode intervals
 * @returns {number[]} Array of MIDI note numbers
 */
function addOneToArrayElements(pc, tonic, mode) {
    var intervals = generateVoicingArray();   
    var outputArray = [pc.pcToKeynum()];

    for (var i = 0; i < intervals.length; i++) {
        var transposed = pc.modalTransposition(intervals[i], tonic, mode);
        outputArray.push(transposed.pcToKeynum());
    }
    return outputArray;
}

function addNToArrayElements(inputArray, tonic, mode) {
 var inputArray = generateVoicingArray();   
 var outputArray = [];

	 outputArray.push(pc.pcToKeynum());

    for (var i = 0; i < inputArray.length; i++) {
  		var updatedValue = pc.modalTransposition(inputArray[i], tonic, mode);
        outputArray.push(updatedValue.pcToKeynum());
    }
    return outputArray;
}

function addArpToArrayElements(inputArray, numoctaves) {
 var outputArray = [];
 var inputArray = inputArray.sort();

for (var j = 0; j < numoctaves; j++) {
    for (var i = 0; i < inputArray.length; i++) {
  		var updatedValue =  (inputArray[i]-12) + (j * 12);  //(inputArray[i] - 0) + (i * 12);
        outputArray.push(updatedValue);
    }
}
    return outputArray;
}

/**
 * Creates arpeggiated pattern from chord voicing
 * @param {number[]} inputArray - Input MIDI notes
 * @param {number} numoctaves - Number of octaves to span
 * @param {number} mode - Arpeggio pattern type (0=up, 1=down, 2=random, 3=paired, 4=grouped)
 * @returns {number[]} Arpeggiated note sequence
 */
function arpArrayElements(inputArray, numoctaves, mode) {
    var outputArray = [];
    
    // Apply pattern transformations
    if(mode == 0) inputArray = inputArray.sort();
    if(mode == 2) inputArray = shuffleArray(inputArray.sort());
    if(mode == 3) inputArray = reverseArray(swapRandomAdjacentPair(inputArray.sort()));
    if(mode == 4) inputArray = reverseArray(swapRandomAdjacentPairs2(inputArray.sort(),2));

    // Generate arpeggio pattern
    for (var j = 0; j < numoctaves; j++) {
        for (var i = 0; i < inputArray.length; i++) {
            outputArray.push((inputArray[i]-12) + (j * 12));
        }
    }

    if(mode == 1) outputArray = reverseArray(outputArray.sort());
    return outputArray;
}

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function reverseArray(inputArray) {
    return inputArray.slice().reverse();
}

function swapRandomAdjacentPair(arr) {
  if (arr.length < 2) {
    return arr; // Array is too short to swap
  }

  const index = Math.floor(Math.random() * (arr.length - 1)); // Generate a random index

  // Swap the adjacent elements at the generated index
  const temp = arr[index];
  arr[index] = arr[index + 1];
  arr[index + 1] = temp;

  return arr;
}

function swapRandomAdjacentPairs2(arr, n) {
  if (n <= 0 || arr.length < 2) {
    return arr; // No swaps needed or array too short
  }

  for (var i = 0; i < n; i++) {
    var index1 = Math.floor(Math.random() * (arr.length - 1));
    var index2 = index1 + 1;

    // Swap the elements
    var temp = arr[index1];
    arr[index1] = arr[index2];
    arr[index2] = temp;
  }

  return arr;
}

function addNToArrayElements(inputArray, n) {
    var outputArray = [];

    for (var i = 0; i < inputArray.length; i++) {
        var updatedValue = inputArray[i] + n;
        outputArray.push(updatedValue);
    }
    return outputArray;
}

function midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function add12ToNRandomElements(array, n) {
    if (n > array.length) {
        throw new Error('Cannot increment more elements than in the array');
    }

    var newArray = array.slice(); // Create a copy of the original array
    var availableIndices = [];
    for (var i = 0; i < newArray.length; i++) {
        availableIndices.push(i);
    }


    for (var i = 0; i < n; i++) {
        var randomIndex = Math.floor(Math.random() * availableIndices.length);
        var chosenIndex = availableIndices[randomIndex];

        newArray[chosenIndex] += 12;
        availableIndices.splice(randomIndex, 1);
    }

    return newArray;
}

function addOctavesToNRandomElements(array, n, dec) {
    if (n > array.length) {
        throw new Error('Cannot increment more elements than in the array');
    }

    var newArray = array.slice(); // Create a copy of the original array
    var availableIndices = [];
    for (var i = 0; i < newArray.length; i++) {
        availableIndices.push(i);
    }

        var randomIndex2 = Math.floor(Math.random(3));

var octave_val = 12;
if(randomIndex2 == 1){
	octave_val = 0;
}
if(randomIndex2 == 0){
	octave_val = 24;
}

    for (var i = 0; i < n; i++) {
        var randomIndex = Math.floor(Math.random() * availableIndices.length);
        var chosenIndex = availableIndices[randomIndex];

	
        
        availableIndices.splice(randomIndex, 1);
    }

    return newArray;
}

function fillArrayWithRandomElements(inputArray, n) {
  var newArray = [];
  
  for (var i = 0; i < n; i++) {
    var randomIndex = Math.floor(Math.random() * inputArray.length);
    newArray.push(inputArray[randomIndex]);
  }
  
  return newArray;
}


function getIndexFromDiffSizeArr(idx, arr1len, arr2len) {
    var index = idx / arr1len; // percentage into array 
    var index2 = index * arr2len; // percentage into new array 
    var roundedidx = Math.floor(index2); // percentage into new array 

    return roundedidx;
}


function createVelocityArray(n) {
  var newArray = [];
newArray.push(2);

	if(n > 1){
 for (var i = 0; i < n-1; i++) {
    newArray.push(1);
  }
}
  return newArray;
}


///////////////////////////////////////////////////

// function to create random minimalist texture


var p = this.patcher;
var c_voicing;

function phrygian_gates_1(){
	
var init_len = getRandomInt(3, 7);
var voice1_length = init_len;
var voice2_length = voice1_length-1;
var voice3_length = voice2_length-1;
var notearray = [];
var notearray2 = [];
var notearray3 = [];
var mode = modes.mixolydian;
var tonic = new PitchClass(0, 5); // Note: 7 (G), Octave: 4
var rand_list1 = getRandomIntArray(voice1_length,0,5);
var rand_list2 = getRandomIntArray(voice2_length,2,5);
var rand_list3 = getRandomIntArray(voice3_length,-1,-5);

var pclist1 = [];
var pclist2 = [];
var pclist3 = [];

  for (var i = 0; i < voice1_length; i++) {
    var outnote =  tonic.modalTransposition(rand_list1[i],tonic,mode);
        pclist1.push(outnote);
        notearray.push(outnote.pcToKeynum());
  }

for (var i = 0; i < voice2_length; i++) {
	var updatedidx = getIndexFromDiffSizeArr(i, voice2_length, voice1_length);
    var outnote2 =  pclist1[0].modalTransposition(rand_list2[i],tonic,mode);

        pclist2.push(outnote2);
		notearray2.push(outnote2.pcToKeynum());
  }

for (var i = 0; i < voice3_length; i++) {
	var updatedidx = getIndexFromDiffSizeArr(i, voice3_length, voice1_length);
    var outnote3 =  pclist1[0].modalTransposition(rand_list3[i],tonic,mode);

        pclist3.push(outnote3);
		notearray3.push(outnote3.pcToKeynum());
  }

post("getIndexFromDiffSizeArr");
post(getIndexFromDiffSizeArr(2,voice2_length, voice1_length));

	post(notearray);
	post("notearray2");
	post(notearray2);
	post("rand_list3");
	post(rand_list3);
	post("createVelocityArray");
	post(createVelocityArray(5));
	
	var c_note = p.getnamed("p_list1");
	var c_note2 = p.getnamed("p_list2");
	var c_note3 = p.getnamed("p_list3");
	
	var tempo_1 = p.getnamed("tempo1");
	var tempo_2 = p.getnamed("tempo2");
	var tempo_3 = p.getnamed("tempo3");
	
	var acc1 = p.getnamed("acc1");
	var acc2 = p.getnamed("acc2");
	var acc3 = p.getnamed("acc3");
	
c_note.set(notearray);
c_note2.set(notearray2);
c_note3.set(notearray3);

tempo_1.set(1000/voice1_length);
tempo_2.set(1000/voice2_length);
tempo_3.set(1000/voice3_length);

acc1.set(createVelocityArray(init_len));
acc2.set(createVelocityArray(voice2_length));
acc3.set(createVelocityArray(voice3_length));

}

// function to create random notes

function modaltrans_accel1(){
	var c_note = p.getnamed("chordnotes1");
	var c_note2 = p.getnamed("chordnotes1[1]");
	
	var nl = p.getnamed("newlist");
	
var notearray = [];
		var notelist = c_note.getattr('boxatoms');
		var mode = modes.lydian;
		var tonic = new PitchClass(0, 5); // Note: 7 (G), Octave: 4
	//	var pitch2 = keynumToPitchClass(vcoi); // Note: 7 (G), Octave: 4
	var rando1 = 	getRandomInt(-2,-3);
	var rando2 = 	getRandomInt(-2,-3);
	var rando3 = 	getRandomInt(-2,-3);
	post(notelist[0])
	 for (var i = 0; i < notelist.length; i++) {
  		var pitch2 = keynumToPitchClass(notelist[i]);
	var outnote =  pitch2.modalTransposition(-1,tonic,mode);
        notearray.push(outnote.pcToKeynum());
    }
c_note.set(notearray);
c_note2.set(notearray);

}

// compute tendency mask around a pitch class for a given mode
// https://cycling74.com/forums/tendency-masks

function tendency() {
  var tendency = p.getnamed("tendency");
  var randomValues = [];
var tonic = new PitchClass(0, 5); // Note: 7 (G), Octave: 4
var mode = modes.lydian;

  for (var i = 0; i < 800; i++) {
    var randomValue = Math.random();
    var upperLimit = Math.floor(20 * (i / 800))+1;
var numsteps = Math.floor((randomValue - 0.5) * upperLimit * 2);
var note = tonic.modalTransposition(numsteps,tonic,mode).pcToKeynum();
    randomValues.push(note); // Scale to be centered around 0 and convert to integer
  }

  tendency.set(randomValues);
}
	

// First, define all your functions
function get_notes_of_key(pc, mode) {
    var step_sum = 0;
    var notes = new Array(mode.length + 1);
    notes[0] = pc.note;

    for (var i = 0; i < mode.length; i++) {
        step_sum = step_sum + mode[i];
        notes[i + 1] = (pc.note + step_sum) % 12;
    }
    return notes;
}

/**
 * Generates euclidean rhythm pattern
 * @param {number} steps - Total steps in pattern
 * @param {number} pulses - Number of active beats
 * @returns {number[]} Binary rhythm pattern
 */
function bjorklund(steps, pulses) {
    if (pulses > steps) return Array(steps).fill(1);
    if (pulses === 0) return Array(steps).fill(0);
    
    const pattern = Array(steps).fill(0);
    const indices = Array.from({length: pulses}, (_, i) => 
        Math.floor(i * steps / pulses)
    );
    
    indices.forEach(i => pattern[i] = 1);
    return pattern;
}

/**
 * Applies modal transposition with specified intervals
 * @param {PitchClass} pc - Root pitch class
 * @param {PitchClass} tonic - Mode tonic
 * @param {number[]} mode - Mode intervals
 * @param {number[]} intervals - Voicing intervals to use
 * @returns {number[]} Array of MIDI note numbers
 */
function generateVoicingFromIntervals(pc, tonic, mode, intervals) {
    var outputArray = [pc.pcToKeynum()];

    for (var i = 0; i < intervals.length; i++) {
        var transposed = pc.modalTransposition(intervals[i], tonic, mode);
        outputArray.push(transposed.pcToKeynum());
    }
    return outputArray;
}

/** 
 * Transpose an array of MIDI notes by modal steps
 * @param {number[]} notes - Array of MIDI note numbers
 * @param {number} steps - Number of scale steps to transpose
 * @param {PitchClass} tonic - Tonic as PitchClass
 * @param {number[]} mode - Mode intervals
 * @returns {number[]} Array of transposed MIDI note numbers
 */
function modalTransposeNotes(notes, steps, tonic, mode) {
    return notes.map(noteNum => {
        const pitch = new PitchClass(noteNum);
        const transposed = pitch.modalTransposition(steps, tonic, mode);
        return transposed.pcToKeynum();
    });
}

// Then at the very end of the file, after ALL functions are defined:
module.exports = {
    modes,
    PitchClass,
    keynumToNote,
    keynumToPitchClass,
    get_notes_of_key,
    get_notes_of_key_fix,
    bjorklund,
    generateVoicingArray,
    addOneToArrayElements,
    generateVoicingFromIntervals,
    modalTransposeNotes,
    noteNameToNumber
};

	
