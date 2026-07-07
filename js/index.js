// ==========================================================
//
// FILE : js/index.js
//
// PART : 1
//
// Firebase Import
// DOM Elements
// Common Functions
//
// ==========================================================

import{

auth,
db,
googleProvider,

signInWithEmailAndPassword,
createUserWithEmailAndPassword,
signInWithPopup,
sendPasswordResetEmail,
onAuthStateChanged,

ref,
set,
get

}from"./firebase-config.js";



// ==========================================================
// LOGIN TAB
// ==========================================================

const loginTab=document.getElementById("loginTab");
const signupTab=document.getElementById("signupTab");

const loginForm=document.getElementById("loginForm");
const signupForm=document.getElementById("signupForm");



// ==========================================================
// LOGIN INPUT
// ==========================================================

const loginEmail=document.getElementById("loginEmail");
const loginPassword=document.getElementById("loginPassword");
const loginBtn=document.getElementById("loginBtn");



// ==========================================================
// SIGNUP INPUT
// ==========================================================

const signupName=document.getElementById("signupName");
const signupEmail=document.getElementById("signupEmail");
const signupPassword=document.getElementById("signupPassword");
const signupConfirm=document.getElementById("signupConfirm");
const signupBtn=document.getElementById("signupBtn");



// ==========================================================
// EXTRA BUTTON
// ==========================================================

const googleLogin=document.getElementById("googleLogin");

const forgotPassword=document.getElementById("forgotPassword");

const rememberMe=document.getElementById("rememberMe");



// ==========================================================
// PASSWORD BUTTON
// ==========================================================

const loginEye=document.getElementById("loginEye");

const signupEye=document.getElementById("signupEye");

const confirmEye=document.getElementById("confirmEye");



// ==========================================================
// LOADING
// ==========================================================

const loadingScreen=document.getElementById("loadingScreen");

const toastBox=document.getElementById("toastBox");



// ==========================================================
// COMMON VARIABLE
// ==========================================================

let loginRunning=false;

let signupRunning=false;

let currentUser=null;



// ==========================================================
// SHOW LOADING
// ==========================================================

function showLoading(){

loadingScreen.classList.add("active");

}



// ==========================================================
// HIDE LOADING
// ==========================================================

function hideLoading(){

loadingScreen.classList.remove("active");

}



// ==========================================================
// TOAST
// ==========================================================

function showToast(message,type="success"){

const toast=document.createElement("div");

toast.className=`toast ${type}`;

toast.innerHTML=message;

toastBox.appendChild(toast);

setTimeout(()=>{

toast.remove();

},3000);

}



// ==========================================================
// MESSAGE
// ==========================================================

function showMessage(msg,type="success"){

let icon="fa-circle-check";

if(type==="error"){

icon="fa-circle-xmark";

}

if(type==="warning"){

icon="fa-triangle-exclamation";

}

showToast(

`<i class="fa-solid ${icon}"></i> ${msg}`,

type

);

}



// ==========================================================
// VALIDATION
// ==========================================================

function empty(v){

return v.trim()=="";

}

function validEmail(v){

return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

}

function validPassword(v){

return v.length>=6;

}

// ==========================================================
//
// FILE : js/index.js
//
// PART : 2
//
// Login UI
// Signup UI
// Password Eye
//
// ==========================================================



// ==========================================================
// LOGIN TAB
// ==========================================================

loginTab.onclick=()=>{

loginTab.classList.add("active");

signupTab.classList.remove("active");

loginForm.classList.add("active");

signupForm.classList.remove("active");

};



// ==========================================================
// SIGNUP TAB
// ==========================================================

signupTab.onclick=()=>{

signupTab.classList.add("active");

loginTab.classList.remove("active");

signupForm.classList.add("active");

loginForm.classList.remove("active");

};



// ==========================================================
// PASSWORD SHOW HIDE
// ==========================================================

function passwordToggle(button,input){

button.onclick=()=>{

if(input.type==="password"){

input.type="text";

button.innerHTML='<i class="fa-solid fa-eye-slash"></i>';

}else{

input.type="password";

button.innerHTML='<i class="fa-solid fa-eye"></i>';

}

};

}



passwordToggle(loginEye,loginPassword);

passwordToggle(signupEye,signupPassword);

passwordToggle(confirmEye,signupConfirm);



// ==========================================================
// BUTTON LOADING
// ==========================================================

function buttonLoading(button,state,text="Please Wait..."){

if(state){

button.disabled=true;

button.dataset.html=button.innerHTML;

button.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;

}else{

button.disabled=false;

if(button.dataset.html){

button.innerHTML=button.dataset.html;

}

}

}



// ==========================================================
// START LOADING
// ==========================================================

function startLoading(button,text){

showLoading();

buttonLoading(button,true,text);

}



// ==========================================================
// STOP LOADING
// ==========================================================

function stopLoading(button){

hideLoading();

buttonLoading(button,false);

}



// ==========================================================
// REMEMBER EMAIL
// ==========================================================

const rememberEmail=

localStorage.getItem("rememberEmail");

if(rememberEmail){

loginEmail.value=rememberEmail;

rememberMe.checked=true;

}



// ==========================================================
// SAVE EMAIL
// ==========================================================

function saveRemember(){

if(rememberMe.checked){

localStorage.setItem(

"rememberEmail",

loginEmail.value.trim()

);

}else{

localStorage.removeItem(

"rememberEmail"

);

}

}



// ==========================================================
// PAGE READY
// ==========================================================

window.onload=()=>{

hideLoading();

console.log("NEXUS CORE READY");

};

// ==========================================================
//
// FILE : js/index.js
//
// PART : 3
//
// Firebase Login
//
// ==========================================================



// ==========================================================
// EMAIL LOGIN
// ==========================================================

loginForm.addEventListener("submit",async(e)=>{

e.preventDefault();

if(loginRunning)return;



if(empty(loginEmail.value)){

showMessage(

"Enter Email",

"warning"

);

return;

}



if(!validEmail(loginEmail.value)){

showMessage(

"Invalid Email",

"warning"

);

return;

}



if(empty(loginPassword.value)){

showMessage(

"Enter Password",

"warning"

);

return;

}



try{

loginRunning=true;

startLoading(

loginBtn,

"Signing In..."

);



const result=

await signInWithEmailAndPassword(

auth,

loginEmail.value.trim(),

loginPassword.value

);



currentUser=result.user;



saveRemember();



showMessage(

"Login Success",

"success"

);



setTimeout(()=>{

window.location.href="home.html";

},1000);



}catch(error){

showMessage(

error.message,

"error"

);

}

finally{

loginRunning=false;

stopLoading(loginBtn);

}

});



// ==========================================================
// AUTO LOGIN
// ==========================================================

onAuthStateChanged(

auth,

(user)=>{

if(user){

currentUser=user;

}

}

);



// ==========================================================
// FORGOT PASSWORD
// ==========================================================

forgotPassword.onclick=async()=>{

const email=

loginEmail.value.trim();



if(empty(email)){

showMessage(

"Enter Email First",

"warning"

);

return;

}



try{

showLoading();



await sendPasswordResetEmail(

auth,

email

);



showMessage(

"Reset Email Sent",

"success"

);

}catch(error){

showMessage(

error.message,

"error"

);

}

finally{

hideLoading();

}

};

// ==========================================================
//
// FILE : js/index.js
//
// PART : 4
//
// Firebase Signup
// Google Login
//
// ==========================================================



// ==========================================================
// SIGNUP
// ==========================================================

signupForm.addEventListener("submit",async(e)=>{

e.preventDefault();

if(signupRunning)return;



if(empty(signupName.value)){

showMessage("Enter Name","warning");

return;

}



if(!validEmail(signupEmail.value)){

showMessage("Invalid Email","warning");

return;

}



if(!validPassword(signupPassword.value)){

showMessage("Password Minimum 6 Characters","warning");

return;

}



if(signupPassword.value!==signupConfirm.value){

showMessage("Password Not Match","warning");

return;

}



const terms=document.getElementById("agreeTerms");

if(!terms.checked){

showMessage("Accept Terms First","warning");

return;

}



try{

signupRunning=true;

startLoading(signupBtn,"Creating...");



const result=

await createUserWithEmailAndPassword(

auth,

signupEmail.value.trim(),

signupPassword.value

);



const user=result.user;



await set(

ref(db,"Users/"+user.uid),

{

uid:user.uid,

name:signupName.value.trim(),

email:signupEmail.value.trim(),

photo:"",

wallet:0,

coins:0,

role:"user",

status:"active",

createdAt:Date.now()

}

);



showMessage(

"Account Created",

"success"

);



setTimeout(()=>{

window.location.href="home.html";

},1000);



}catch(error){

showMessage(error.message,"error");

}

finally{

signupRunning=false;

stopLoading(signupBtn);

}

});



// ==========================================================
// GOOGLE LOGIN
// ==========================================================

googleLogin.onclick=async()=>{

try{

startLoading(

googleLogin,

"Connecting..."

);



const result=

await signInWithPopup(

auth,

googleProvider

);



const user=result.user;



const userRef=

ref(

db,

"Users/"+user.uid

);



const snap=

await get(userRef);



if(!snap.exists()){

await set(

userRef,

{

uid:user.uid,

name:user.displayName||"User",

email:user.email,

photo:user.photoURL||"",

wallet:0,

coins:0,

role:"user",

status:"active",

createdAt:Date.now()

}

);

}



showMessage(

"Google Login Success",

"success"

);



setTimeout(()=>{

window.location.href="home.html";

},1000);



}catch(error){

showMessage(

error.message,

"error"

);

}

finally{

stopLoading(googleLogin);

}

};