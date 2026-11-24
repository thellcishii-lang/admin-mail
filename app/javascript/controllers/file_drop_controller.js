import { Controller } from "@hotwired/stimulus"

// ファイルのドラッグ＆ドロップで添付を選ぶ（クリックでも選択可）
export default class extends Controller {
  static targets = ["input", "list"]

  open() {
    this.inputTarget.click()
  }

  highlight(event) {
    event.preventDefault()
    this.element.classList.add("border-blue-500", "bg-blue-50")
  }

  unhighlight(event) {
    event.preventDefault()
    this.element.classList.remove("border-blue-500", "bg-blue-50")
  }

  drop(event) {
    event.preventDefault()
    this.unhighlight(event)
    if (event.dataTransfer.files.length > 0) {
      this.inputTarget.files = event.dataTransfer.files
      this.showFiles()
    }
  }

  changed() {
    this.showFiles()
  }

  showFiles() {
    const names = Array.from(this.inputTarget.files).map((file) => file.name)
    this.listTarget.textContent = names.length > 0 ? names.join("、") : ""
  }
}
