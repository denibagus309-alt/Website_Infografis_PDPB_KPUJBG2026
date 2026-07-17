
let data=[];

function tampil(){

let tb=document.querySelector("#tbl tbody");

tb.innerHTML="";

let lk=0;

let pr=0;

data.forEach(x=>{

tb.innerHTML+=`

<tr>

<td>${x.nik}</td>

<td>${x.nama}</td>

<td>${x.jk}</td>

<td>${x.umur}</td>

<td>${x.pendidikan}</td>

<td>${x.pekerjaan}</td>

</tr>

`;

if(x.jk=="Laki-laki")

lk++;

else

pr++;

});

document.getElementById("total").innerHTML=data.length;

document.getElementById("lk").innerHTML=lk;

document.getElementById("pr").innerHTML=pr;

grafik(lk,pr);

}

function grafik(l,p){

new Chart(document.getElementById("jkChart"),{

type:"pie",

data:{

labels:["Laki-laki","Perempuan"],

datasets:[{

data:[l,p]

}]

}

});

}

function exportExcel(){

let wb=XLSX.utils.book_new();

let ws=XLSX.utils.json_to_sheet(data);

XLSX.utils.book_append_sheet(wb,ws,"Penduduk");

XLSX.writeFile(wb,"Penduduk.xlsx");

}

async function exportPDF(){

const {jsPDF}=window.jspdf;

let pdf=new jsPDF();

pdf.text("Laporan Data Penduduk",20,20);

let y=40;

data.forEach(x=>{

pdf.text(

`${x.nik} ${x.nama} ${x.jk}`,

20,

y

);

y+=10;

});

pdf.save("Laporan.pdf");

}
