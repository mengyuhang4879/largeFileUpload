<template>
  <div id="app">
    <el-upload
      drag
      action
      :auto-upload="false"
      :show-file-list="false"
      :on-change="changeFile"
    >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        将文件拖到此处，或
        <em>点击上传</em>
      </div>
    </el-upload>

    <!-- PROGRESS -->
    <div class="progress">
      <span>上传进度：{{ totalNum }}%</span>
      <el-link
        v-if="total > 0 && total < 30"
        type="primary"
        @click="handleBtn"
        >{{ btn | btnText }}</el-link
      >
    </div>

    <!-- VIDEO -->
    <div class="uploadImg" v-if="video">
      <video :src="video" controls />
    </div>
  </div>
</template>

<script>
import SparkMD5 from "spark-md5";
export default {
  name: "App",
  data() {
    return {
      total: 0,
      video: null,
      btn: false,
      HASH: "",
      chunks: [],
      already: [],
      requestList: [],
      count: 0,
      alreadyUploadIndex: 0,
    };
  },
  filters: {
    btnText(btn) {
      return btn ? "继续" : "暂停";
    },
  },
  computed: {
    totalNum() {
      let isNum = (num) => num != null && !isNaN(num);
      let n =
        isNum(this.count) && isNum(this.total)
          ? ((this.total / this.count) * 100).toFixed(0)
          : 0;
      return isNaN(n) ? 0 : n;
    },
  },
  methods: {
    async changeFile(file) {
      if (!file) return;
      file = file.raw;
    //   读取文件成buffer类型
      let buffer = await this.fileParse(file, "buffer");
      let suffix = this.createName(buffer, file);
    //   校验已经上传的文件切片
      let data = await this.axios.get("/upload_already", {
        params: {
          HASH: this.HASH,
        },
      });
      this.already = data.fileList;
      this.total = data.fileList.length;
    //   拆分切片
      this.splitBuffer(file, suffix);
    //   将切片存储到事件池中
      this.saveEventPool()
    //   向服务端发送切片 并且校验是否已经传输完毕 如果传输完毕则调用服务端的合并接口
      this.sendRequest();
    },
    //  将文件读取成buffer类型
    fileParse(file, type) {
      return new Promise((resolve) => {
        let fileRead = new FileReader();
        fileRead.readAsArrayBuffer(file);
        fileRead.onload = (ev) => {
          resolve(ev.target.result);
        };
      });
    },
    // 前端生成文件名
    createName(buffer, file) {
      let spark = new SparkMD5.ArrayBuffer();
      spark.append(buffer);
      this.HASH = spark.end();
      let suffix = /\.([0-9a-zA-Z]+)$/i.exec(file.name)[1];
      return suffix;
    },
    // 根据buffer的大小进行合理的拆分
    splitBuffer(file, suffix) {
      let max = 1024 * 100,
        index = 0;
      this.count = Math.ceil(file.size / max);
      if (this.count > 30) {
        max = file.size / 30;
        this.count = 30;
      }
      while (index < this.count) {
        this.chunks.push({
          file: file.slice(index * max, (index + 1) * max),
          filename: `${this.HASH}_${index + 1}.${suffix}`,
        });
        index++;
      }
    },
    //使用发布订阅模式先将切片方法存储到事件池中
    saveEventPool() {
      this.chunks.forEach((chunk, index) => {
        if (this.already.length > 0 && this.already.includes(chunk.filename)) {
          return;
        }
        let fn = () => {
          let fm = new FormData();
          fm.append("file", chunk.file);
          fm.append("filename", chunk.filename);
          return this.axios.post("/upload_chunk", fm).then((data) => {
            this.total++;
          });
        };
        this.requestList.push(fn);
      });
    },
   
    async complete() {
      if (this.total < 30) return;
      let res = await this.axios.post(
        "/upload_merge",
        {
          HASH: this.HASH,
          count: this.count,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      this.video = res.servicePath;
      alert("成功");
    },

    async sendRequest() {
      let send = async () => {
        // 已经中断则不再上传
        if (this.abort) return;
        if (this.alreadyUploadIndex >= this.requestList.length) {
          // 都传完了
          this.complete();
          return;
        }
        await this.requestList[this.alreadyUploadIndex]();
        this.alreadyUploadIndex++;
        send();
      };
      send();
    },
    // 暂停/继续
    handleBtn() {
      if (this.btn) {
        //断点续传
        this.abort = false;
        this.btn = false;
        this.sendRequest();
        return;
      }
      //暂停上传
      this.btn = true;
      this.abort = true;
    },
  },
};
</script>
