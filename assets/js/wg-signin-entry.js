/* "Add a program you bought" on the app home opens the sign-in screen, where she can use her email or a
   program code. It is the real row for everyone from the Bachs launch. */
(function () {
  var add = document.getElementById("appAdd");
  if (!add) return;
  var row = document.createElement("a");
  row.className = add.className.replace("app-addprog", "") + " app-addprog";
  row.href = "/signin/?option=b";
  row.id = "appAdd";
  row.style.display = "block"; row.style.textDecoration = "none"; row.style.color = "inherit";
  row.innerHTML = '<span class="ab-sum" style="display:flex;gap:12px;align-items:center;padding:14px 16px;font-weight:800">' +
    '<span class="ab-ico" aria-hidden="true">🎟️</span><span class="ab-txt">Add a program you bought' +
    '<small style="display:block;font-weight:400;opacity:.75">Sign in with your email, or type your code</small></span>' +
    '<span aria-hidden="true" style="margin-left:auto">›</span></span>';
  add.replaceWith(row);
})();
